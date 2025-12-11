import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';

import fs, { mkdirSync, writeFileSync, chmodSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import {
    EXECUTABLE_SCRIPTS,
    PLATFORM_DOWNLOAD_URLS,
    ENV_CONFIG,
    INPUT_KEYS,
    OS_PLATFORM,
    OPERATIONS,
    SIGNING_TOOL_DIR,
    SIGN_METHOD,
    JAVA_EXEC_TEMPLATES
} from './constants';
import { PROD_ENV_SETTINGS, SANDBOX_ENV_SETTINGS } from './config';

import { unzipToDestination, fetchInputValue, identifyPlatform, debugListDirectory, appendParameter, resolveUserShell } from './util';

export class SigningToolManager {
    constructor() {}

    private getDownloadDetails() {
        const currentPlatform = identifyPlatform();
        const isWindows = currentPlatform === OS_PLATFORM.WIN_SYSTEM;

        return {
            downloadUrl: isWindows ? PLATFORM_DOWNLOAD_URLS.windows : PLATFORM_DOWNLOAD_URLS.unix,
            executableScript: isWindows ? EXECUTABLE_SCRIPTS.windows : EXECUTABLE_SCRIPTS.unix,
            platform: currentPlatform
        };
    }

    private writeConfiguration(toolPath: string, environment: string): void {
        const configContent = environment === ENV_CONFIG.PRODUCTION ? PROD_ENV_SETTINGS : SANDBOX_ENV_SETTINGS;
        const configPath = path.join(toolPath, 'conf/code_sign_tool.properties');

        core.info(`Writing configuration file to ${configPath}`);
        writeFileSync(configPath, configContent, { encoding: 'utf-8', flag: 'w' });
    }

    private buildExecutableCommand(toolPath: string, scriptName: string, signVersion: string, memoryLimit: string, platform: string): string {
        if (signVersion === SIGN_METHOD.VERSION_ONE) {
            const scriptPath = path.join(toolPath, scriptName);
            const scriptContent = readFileSync(scriptPath, { encoding: 'utf-8', flag: 'r' });
            const modifiedContent = scriptContent
                .replace(/java -jar/g, `java -Xmx${memoryLimit} -jar`)
                .replace(/\$@/g, `"\$@"`);

            core.info(`Prepared executable command with memory limit: ${memoryLimit}`);
            writeFileSync(scriptPath, modifiedContent, { encoding: 'utf-8', flag: 'w' });
            chmodSync(scriptPath, '0755');

            return scriptPath;
        } else {
            const isWindows = platform === OS_PLATFORM.WIN_SYSTEM;
            const template = isWindows ? JAVA_EXEC_TEMPLATES.windows : JAVA_EXEC_TEMPLATES.unix;

            return template
                .replace(/\${{ CODE_SIGN_TOOL_PATH }}/g, toolPath)
                .replace(/\${{ JVM_MAX_MEMORY }}/g, memoryLimit);
        }
    }

    private hasExecutionError(output: { stdout: string; stderr: string }): boolean {
        const errorPatterns = ['Error', 'Exception', 'Missing required option', 'Unmatched arguments from', 'Unmatched argument'];
        const checkStream = (stream: string) => errorPatterns.some(pattern => stream.includes(pattern));

        return checkStream(output.stdout) || checkStream(output.stderr);
    }

    public async initialize(): Promise<string> {
        const workDir = path.resolve(process.cwd());
        debugListDirectory(workDir);

        const { downloadUrl, executableScript, platform } = this.getDownloadDetails();

        const toolBaseDir = path.resolve(process.cwd(), 'codesign');
        if (!existsSync(toolBaseDir)) {
            mkdirSync(toolBaseDir);
            core.info(`Created tool base directory: ${toolBaseDir}`);
        }

        const toolPath = await this.ensureToolDownloaded(toolBaseDir, downloadUrl);
        core.info(`Signing tool installed at: ${toolPath}`);
        debugListDirectory(toolPath);

        const environment = core.getInput(INPUT_KEYS.ENV_NAME) || ENV_CONFIG.PRODUCTION;
        const memoryLimit = core.getInput(INPUT_KEYS.MEMORY_LIMIT) || '2048M';
        const signVersion = core.getInput(INPUT_KEYS.SIGN_VERSION) || SIGN_METHOD.VERSION_ONE;

        this.writeConfiguration(toolPath, environment);

        core.info(`Configured signing tool path: ${toolPath}`);
        core.exportVariable(`CODE_SIGN_TOOL_PATH`, toolPath);

        const executableCmd = this.buildExecutableCommand(toolPath, executableScript, signVersion, memoryLimit, platform);
        const shellPrefix = resolveUserShell(signVersion);

        core.info(`Shell command: ${shellPrefix}`);
        core.info(`Executable command: ${executableCmd}`);

        const finalCommand = `${shellPrefix} ${executableCmd}`.trim();
        return finalCommand;
    }

    private buildScanCommand(operation: string): string {
        let scanCmd: string = OPERATIONS.CODE_SCAN;
        const paramKeys = [INPUT_KEYS.USER, INPUT_KEYS.PASS, INPUT_KEYS.CRED_ID, INPUT_KEYS.PROGRAM];

        for (const key of paramKeys) {
            scanCmd = appendParameter(key, scanCmd, operation);
        }

        return scanCmd;
    }

        private async ensureToolDownloaded(baseDir: string, downloadUrl: string): Promise<string> {
        const cachedPath = process.env['CODESIGNTOOL_PATH'];
        const defaultPath = path.join(baseDir, SIGNING_TOOL_DIR);
        let toolPath = cachedPath ?? defaultPath;

        if (!existsSync(toolPath)) {
            core.info(`Fetching signing tool from ${downloadUrl}`);
            const downloadedArchive = await tc.downloadTool(downloadUrl);
            await unzipToDestination(downloadedArchive, path.join(baseDir, SIGNING_TOOL_DIR));
            core.info(`Extracting signing tool archive from ${downloadedArchive} to ${baseDir}`);

            const extractedDirs = fs.readdirSync(baseDir);
            toolPath = path.join(baseDir, extractedDirs[0]);
            core.exportVariable(`CODESIGNTOOL_PATH`, toolPath);
        }

        return toolPath;
    }

    public async performMalwareScan(baseCommand: string, operation: string): Promise<boolean> {
        const scanCommand = this.buildScanCommand(operation);
        const targetDirectory = path.normalize(fetchInputValue(INPUT_KEYS.DIR));
        const fileEntries = fs.readdirSync(targetDirectory);

        for (const entry of fileEntries) {
            const fullFilePath = path.join(targetDirectory, entry);
            const scanWithFile = `${scanCommand} -input_file_path="${fullFilePath}"`;
            const completeScanCmd = `${baseCommand} ${scanWithFile}`;

            core.info(`Scanning file for malware: ${entry}`);

            const execResult = await exec.getExecOutput(completeScanCmd, [], { windowsVerbatimArguments: false });

            if (this.hasExecutionError(execResult)) {
                return false;
            }
        }

        return true;
    }
}
