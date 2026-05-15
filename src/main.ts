import * as core from '@actions/core';
import * as exec from '@actions/exec';
import axios, {isAxiosError} from 'axios'

import fs from 'fs';
import path from 'path';
import { OPERATIONS, INPUT_KEYS } from './constants';

import { SigningToolManager } from './setup-codesigner';
import { CorrettoJdkProvider } from './setup-jdk-installer';
import { assembleCommandString } from './util';

// Check if Java installation is required
const isJavaInstallationNeeded = (): boolean => {
    const currentVersion = parseInt(process.env['JAVA_VERSION'] ?? '0');
    const minimumRequired = 11;
    return currentVersion < minimumRequired;
};

// Check for errors in execution output
const detectExecutionErrors = (output: { stdout: string; stderr: string }): boolean => {
    const errorIndicators = ['Error', 'Exception', 'Missing required option', 'Unmatched arguments from', 'Unmatched argument'];

    const hasError = (stream: string) => errorIndicators.some(indicator => stream.includes(indicator));

    return hasError(output.stdout) || hasError(output.stderr);
};

// Clean up log files if requested
const performLogCleanup = (commandPath: string): void => {
    const shouldClean = core.getBooleanInput(INPUT_KEYS.LOG_CLEANUP);

    if (shouldClean) {
        const baseDirectory = path.dirname(commandPath);
        const logDirectory = path.join(baseDirectory, 'logs');

        fs.rmSync(logDirectory, { recursive: true, force: true });
        core.info(`Log directory cleaned: ${logDirectory}`);
    }
};

// Setup Java environment if needed
const setupJavaEnvironment = async (): Promise<string> => {
    let javaHomePath = process.env['JAVA_HOME'] ?? '';
    const javaVer = parseInt(process.env['JAVA_VERSION'] ?? '0');

    core.info(`Java home directory: ${javaHomePath}`);
    core.info(`Java version: ${javaVer}`);

    if (isJavaInstallationNeeded()) {
        const jdkProvider = new CorrettoJdkProvider();
        await jdkProvider.performSetup();
        javaHomePath = process.env['JAVA_HOME'] ?? '';
    } else {
        core.info(`Java already installed at: ${javaHomePath}`);
    }

    return javaHomePath;
};

async function validateSubscription(): Promise<void> {
  const eventPath = process.env.GITHUB_EVENT_PATH
  let repoPrivate: boolean | undefined

  if (eventPath && fs.existsSync(eventPath)) {
    const eventData = JSON.parse(fs.readFileSync(eventPath, 'utf8'))
    repoPrivate = eventData?.repository?.private
  }

  const upstream = 'sslcom/esigner-codesign'
  const action = process.env.GITHUB_ACTION_REPOSITORY
  const docsUrl =
    'https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions'

  core.info('')
  core.info('[1;36mStepSecurity Maintained Action[0m')
  core.info(`Secure drop-in replacement for ${upstream}`)
  if (repoPrivate === false)
    core.info('[32m✓ Free for public repositories[0m')
  core.info(`[36mLearn more:[0m ${docsUrl}`)
  core.info('')

  if (repoPrivate === false) return

  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com'
  const body: Record<string, string> = {action: action || ''}
  if (serverUrl !== 'https://github.com') body.ghes_server = serverUrl
  try {
    await axios.post(
      `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/maintained-actions-subscription`,
      body,
      {timeout: 3000}
    )
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 403) {
      core.error(
        `[1;31mThis action requires a StepSecurity subscription for private repositories.[0m`
      )
      core.error(
        `[31mLearn how to enable a subscription: ${docsUrl}[0m`
      )
      process.exit(1)
    }
    core.info('Timeout or API not reachable. Continuing to next step.')
  }
}


// Main execution function
async function main(): Promise<void> {
    try {
        await validateSubscription();
        core.debug('Initializing code signing workflow');
        core.debug('Starting signing action execution');

        const operationType = core.getInput(INPUT_KEYS.CMD);
        const commandParameters = assembleCommandString(operationType);
        core.info(`Command parameters: ${commandParameters}`);

        const javaPath = await setupJavaEnvironment();

        const signingTool = new SigningToolManager();
        let toolCommand = await signingTool.initialize();
        toolCommand = toolCommand.replace(/\${{ JAVA_HOME }}/g, `${javaPath}/bin/java`);
        const fullCommand = `${toolCommand} ${commandParameters}`;
        core.info(`Executing signing command: ${fullCommand}`);

        const malwareScanEnabled = core.getInput(INPUT_KEYS.MALWARE_CHECK, { required: false });
        const shouldScan = malwareScanEnabled.toUpperCase() === 'TRUE';
        core.info(`Malware scanning: ${shouldScan ? 'enabled' : 'disabled'}`);

        if (operationType === OPERATIONS.BULK_SIGN && shouldScan) {
            const scanSuccess = await signingTool.performMalwareScan(toolCommand, operationType);
            if (!scanSuccess) {
                core.info('');
                core.setFailed('Something Went Wrong. Please try again.');
                return;
            }
        }

        const executionResult = await exec.getExecOutput(fullCommand, [], { windowsVerbatimArguments: false });

        performLogCleanup(fullCommand);

        if (detectExecutionErrors(executionResult)) {
            core.info('');
            core.setFailed('Something Went Wrong. Please try again.');
            return;
        }

        core.setOutput('CodeSigner', executionResult);
    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
    }
}

main().then();
