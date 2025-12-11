import os, { userInfo } from 'os';
import path from 'path';
import * as fs from 'fs';
import * as semver from 'semver';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import {
    COMMAND_PARAMETERS,
    INPUT_KEYS,
    OS_PLATFORM,
    SIGN_METHOD
} from './constants';

export function getTempDir() {
    const runnerTemp = process.env['RUNNER_TEMP'];
    return runnerTemp || os.tmpdir();
}


export async function unzipToDestination(toolPath: string, destPath: string) {
    return await tc.extractZip(toolPath, destPath);
}

export function detectArchiveFormat() {
    const platformName = process.platform;
    return platformName === 'win32' ? 'zip' : 'tar.gz';
}

export function checkVersionCompatibility(range: string, version: string): boolean {
    const isValid = semver.valid(range);
    if (isValid) {
        const semRange = semver.parse(range);
        const hasBuild = semRange && semRange.build?.length > 0;
        if (hasBuild) {
            return semver.compareBuild(range, version) === 0;
        }
    }

    return semver.satisfies(version, range);
}

export function findCachedTool(toolName: string, version: string, architecture: string) {
    const toolCacheRoot = process.env['RUNNER_TOOL_CACHE'] ?? '';
    const fullPath = path.join(toolCacheRoot, toolName, version, architecture);
    const pathExists = fs.existsSync(fullPath);
    if (pathExists) {
        return fullPath;
    }

    return null;
}

export function identifyPlatform(): string {
    switch (process.platform) {
        case 'darwin':
            return OS_PLATFORM.MAC_OS_SYSTEM;
        case 'win32':
            return OS_PLATFORM.WIN_SYSTEM;
        default:
            return OS_PLATFORM.UNIX_SYSTEM;
    }
}

export function debugListDirectory(dirPath: string): void {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        core.debug(`File: ${file}`);
    }
}


export function fetchInputValue(inputKey: string) {
    return expandEnvironmentVars(core.getInput(inputKey));
}

export function resolveUserShell(signingMethod: string): string | null {
    const { env } = process;
    const platform = identifyPlatform();

    if (platform == OS_PLATFORM.WIN_SYSTEM) {
        return '';
    }
    if (signingMethod == SIGN_METHOD.VERSION_TWO) {
        return '';
    }

    try {
        const userShellInfo = userInfo();
        if (userShellInfo) {
            return userShellInfo.shell;
        }
    } catch {
        // Ignored
    }

    if (platform === OS_PLATFORM.MAC_OS_SYSTEM) {
        return env.SHELL ?? '/bin/zsh';
    }

    return env.SHELL ?? '/bin/sh';
}

export async function unpackJavaArchive(toolPath: string, extension?: string) {
    let fileExtension = extension;
    if (!fileExtension) {
        fileExtension = toolPath.endsWith('.tar.gz') ? 'tar.gz' : path.extname(toolPath);
        if (fileExtension.startsWith('.')) {
            fileExtension = fileExtension.substring(1);
        }
    }

    switch (fileExtension) {
        case 'tar.gz':
        case 'tar':
            return await tc.extractTar(toolPath);
        case 'zip':
            return await tc.extractZip(toolPath);
        default:
            return await tc.extract7z(toolPath);
    }
}


export function expandEnvironmentVars(input: string): string {
    let result = input;
    const variables = process.env;
    for (const envKey in variables) {
        const envValue = variables[envKey];
        // @ts-ignore
        result = result.replace('${' + envKey + '}', envValue);
    }
    return result;
}

export function assembleCommandString(action: string): string {
    let cmd = `${core.getInput(INPUT_KEYS.CMD)}`;
    cmd = appendParameter(INPUT_KEYS.USER, cmd, action);
    cmd = appendParameter(INPUT_KEYS.PASS, cmd, action);
    cmd = appendParameter(INPUT_KEYS.CRED_ID, cmd, action);
    cmd = appendParameter(INPUT_KEYS.TOTP, cmd, action);
    cmd = appendParameter(INPUT_KEYS.PROGRAM, cmd, action);
    cmd = appendParameter(INPUT_KEYS.FILE, cmd, action);
    cmd = appendParameter(INPUT_KEYS.DIR, cmd, action);
    cmd = appendParameter(INPUT_KEYS.OUTPUT, cmd, action);
    cmd = appendParameter(INPUT_KEYS.FORCE_OVERRIDE, cmd, action);
    cmd = appendParameter(INPUT_KEYS.MALWARE_CHECK, cmd, action);
    return cmd;
}


export function appendParameter(inputKey: string, command: string, action: string): string {
    let inputValue = fetchInputValue(inputKey);
    if (inputValue == '') {
        return command;
    }
    const supportCommands = COMMAND_PARAMETERS.get(action);
    const isSupported = supportCommands?.includes(inputKey);
    if (!isSupported) {
        return command;
    }

    let updatedCommand = command;
    if (inputKey == INPUT_KEYS.USER) {
        updatedCommand = `${updatedCommand} -username="${inputValue}"`;
    } else if (inputKey == INPUT_KEYS.PASS) {
        updatedCommand = `${updatedCommand} -password="${inputValue}"`;
    } else if (inputKey == INPUT_KEYS.CRED_ID) {
        updatedCommand = `${updatedCommand} -credential_id="${inputValue}"`;
    } else if (inputKey == INPUT_KEYS.TOTP) {
        updatedCommand = `${updatedCommand} -totp_secret="${inputValue}"`;
    } else if (inputKey == INPUT_KEYS.PROGRAM) {
        updatedCommand = `${updatedCommand} -program_name="${inputValue}"`;
    } else if (inputKey == INPUT_KEYS.FILE) {
        inputValue = path.normalize(inputValue);
        updatedCommand = `${updatedCommand} -input_file_path="${inputValue}"`;
    } else if (inputKey == INPUT_KEYS.DIR) {
        inputValue = path.normalize(inputValue);
        updatedCommand = `${updatedCommand} -input_dir_path="${inputValue}"`;
    } else if (inputKey == INPUT_KEYS.OUTPUT) {
        inputValue = path.normalize(inputValue);
        const outputExists = fs.existsSync(inputValue);
        if (outputExists) {
            core.info(`Output directory already exists: ${inputValue}`);
        } else {
            core.info(`Creating output directory: ${inputValue}`);
            fs.mkdirSync(inputValue);
        }
        updatedCommand = `${updatedCommand} -output_dir_path="${inputValue}"`;
    } else if (inputKey == INPUT_KEYS.MALWARE_CHECK) {
        updatedCommand = `${updatedCommand} -malware_block=${inputValue}`;
    } else if (inputKey == INPUT_KEYS.FORCE_OVERRIDE) {
        updatedCommand = `${updatedCommand} -override=${inputValue}`;
    }
    return updatedCommand;
}


