import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as fs from 'fs';
import semver from 'semver';
import path from 'path';
import * as httpm from '@actions/http-client';
import { findCachedTool, checkVersionCompatibility } from './util';
import { JAVA_MAC_PATH_SUFFIX } from './constants';
import os from 'os';

export interface JdkSetupOptions {
    version: string;
    architecture: string;
    packageType: string;
    checkLatest: boolean;
}

export interface JdkSetupResult {
    version: string;
    path: string;
}

export interface JdkReleaseInfo {
    version: string;
    url: string;
}

export abstract class JdkInstallationBase {
    protected httpClient: httpm.HttpClient;
    protected jdkVersion: string;
    protected systemArchitecture: string;
    protected distributionType: string;
    protected isStableRelease: boolean;
    protected shouldCheckLatest: boolean;

    protected constructor(protected distributionName: string) {
        this.httpClient = new httpm.HttpClient('actions-codesign', undefined, {
            allowRetries: true,
            maxRetries: 3
        });

        const versionInfo = this.parseVersion('11');
        this.jdkVersion = versionInfo.version;
        this.isStableRelease = versionInfo.stable;
        this.systemArchitecture = os.arch();
        this.distributionType = 'jdk';
        this.shouldCheckLatest = false;
    }

    protected configureJavaEnvironment(versionStr: string, installPath: string): void {
        const majorVersionNumber = versionStr.split('.')[0];
        const archUppercase = this.systemArchitecture.toUpperCase();

        core.exportVariable('JAVA_HOME', installPath);
        core.addPath(path.join(installPath, 'bin'));
        core.setOutput('distribution', this.distributionName);
        core.setOutput('path', installPath);
        core.setOutput('version', versionStr);
        core.exportVariable(`JAVA_HOME_${majorVersionNumber}_${archUppercase}`, installPath);
        core.exportVariable(`JAVA_VERSION`, majorVersionNumber);
    }

    protected parseVersion(versionStr: string): { version: string; stable: boolean } {
        let isStable = true;
        let cleanedVersion = versionStr;

        if (versionStr.endsWith('-ea')) {
            cleanedVersion = versionStr.replace(/-ea$/, '');
            isStable = false;
        } else if (versionStr.includes('-ea.')) {
            cleanedVersion = versionStr.replace('-ea.', '+');
            isStable = false;
        }

        const isValidSemver = semver.validRange(cleanedVersion);
        if (!isValidSemver) {
            throw new Error(`The string '${versionStr}' is not valid SemVer notation for a Java version. Please check README file for code snippets and more detailed information`);
        }

        return { version: cleanedVersion, stable: isStable };
    }

    protected abstract fetchJdkArchive(releaseInfo: JdkReleaseInfo): Promise<JdkSetupResult>;

    protected abstract locateReleaseForVersion(versionRange: string): Promise<JdkReleaseInfo>;

    protected get cachedToolDirectory(): string {
        return `Java_${this.distributionName}_${this.distributionType}`;
    }

    protected formatCacheVersionName(versionString: string): string {
        const isEarlyAccess = !this.isStableRelease;

        if (isEarlyAccess) {
            return versionString.includes('+') ? versionString.replace('+', '-ea.') : `${versionString}-ea`;
        }

        return versionString.replace('+', '-');
    }

    protected searchToolCache(): JdkSetupResult | null {
        const cachedVersions = this.getCachedVersionsList();
        const matchingVersions = this.filterAndSortVersions(cachedVersions);

        if (!matchingVersions || matchingVersions.length === 0) {
            return null;
        }

        const bestMatch = matchingVersions[0];
        return { version: bestMatch.version, path: bestMatch.path };
    }

    private filterAndSortVersions(versions: Array<{ version: string; path: string; stable: boolean }>): Array<{ version: string; path: string }> {
        return versions
            .filter(entry => checkVersionCompatibility(this.jdkVersion, entry.version))
            .filter(entry => entry.path)
            .sort((first, second) => -semver.compareBuild(first.version, second.version));
    }

    private getCachedVersionsList(): Array<{ version: string; path: string; stable: boolean }> {
        return tc
            .findAllVersions(this.cachedToolDirectory, this.systemArchitecture)
            .map(versionStr => {
                const normalizedVersion = this.normalizeVersionString(versionStr);
                const toolPath = findCachedTool(this.cachedToolDirectory, versionStr, this.systemArchitecture) || '';
                const isStable = !versionStr.includes('-ea');

                return { version: normalizedVersion, path: toolPath, stable: isStable };
            })
            .filter(entry => entry.stable === this.isStableRelease);
    }

    private normalizeVersionString(versionStr: string): string {
        return versionStr
            .replace('-ea.', '+')
            .replace(/-ea$/, '')
            .replace('-', '+');
    }

    protected translateArchitecture(): string {
        const archMap: Record<string, string> = {
            'amd64': 'x64',
            'ia32': 'x86',
            'arm64': 'aarch64'
        };

        return archMap[this.systemArchitecture] || this.systemArchitecture;
    }

    public async performSetup(): Promise<JdkSetupResult> {
        let jdkInstallation = this.searchToolCache();
        const shouldFetchLatest = this.shouldCheckLatest;

        if (jdkInstallation && !shouldFetchLatest) {
            core.info(`Found JDK ${jdkInstallation.version} in cache`);
        } else {
            core.info('Resolving latest JDK version from remote');
            const releasePackage = await this.locateReleaseForVersion(this.jdkVersion);
            core.info(`Latest version identified: ${releasePackage.version}`);

            const isCachedVersionMatching = jdkInstallation?.version === releasePackage.version;
            if (isCachedVersionMatching && jdkInstallation) {
                core.info(`Found JDK ${jdkInstallation.version} in cache`);
            } else {
                core.info('Downloading JDK package');
                jdkInstallation = await this.fetchJdkArchive(releasePackage);
                core.info(`JDK ${jdkInstallation.version} downloaded successfully`);
            }
        }

        if (!jdkInstallation) {
            throw new Error('Failed to setup JDK installation');
        }

        // Handle macOS specific JDK path structure
        const macosJdkPath = path.join(jdkInstallation.path, JAVA_MAC_PATH_SUFFIX);
        const isMacOS = process.platform === 'darwin';
        if (isMacOS && fs.existsSync(macosJdkPath)) {
            jdkInstallation.path = macosJdkPath;
        }

        core.info(`Configuring JDK ${jdkInstallation.version} as default`);
        this.configureJavaEnvironment(jdkInstallation.version, jdkInstallation.path);

        return jdkInstallation;
    }
}
