import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import fs from 'fs';
import path from 'path';
import { unpackJavaArchive, detectArchiveFormat } from './util';
import { JdkInstallationBase, JdkReleaseInfo, JdkSetupResult } from './setup-jdk-base-installer';

export class CorrettoJdkProvider extends JdkInstallationBase {
    constructor() {
        super('Corretto');
    }

    private findMatchingReleases(releases: CorrettoVersionDetails[], targetVersion: string): JdkReleaseInfo[] {
        return releases
            .filter(release => release.version === targetVersion)
            .map(release => ({
                version: release.correttoVersion,
                url: release.downloadLink
            } as JdkReleaseInfo));
    }

    private formatVersionList(releases: CorrettoVersionDetails[]): string {
        return releases.map(r => r.version).join(', ');
    }
    private determinePlatformName(): string {
        const platformMapping: Record<string, string> = {
            'darwin': 'macos',
            'win32': 'windows'
        };

        return platformMapping[process.platform] || process.platform;
    }

    private extractVersionFromPath(resourcePath: string): string {
        const versionPattern = /(\d+.+)\//;
        const matched = versionPattern.exec(resourcePath);

        if (!matched) {
            throw Error(`Could not parse corretto version from ${resourcePath}`);
        }

        return matched[1];
    }

    protected async locateReleaseForVersion(versionStr: string): Promise<JdkReleaseInfo> {
        if (!this.isStableRelease) {
            throw new Error('Early access versions are not supported');
        }
        if (versionStr.includes('.')) {
            throw new Error('Only major versions are supported');
        }

        const availableReleases = await this.fetchAvailableReleases();
        const compatibleReleases = this.findMatchingReleases(availableReleases, versionStr);

        const selectedRelease = compatibleReleases.length > 0 ? compatibleReleases[0] : null;

        if (!selectedRelease) {
            const versionList = this.formatVersionList(availableReleases);
            const errorSuffix = versionList ? `\nAvailable versions: ${versionList}` : '';
            throw new Error(`Could not find satisfied version for SemVer '${versionStr}'. ${errorSuffix}`);
        }

        return selectedRelease;
    }


    private extractPlatformVersions(versionData: CorrettoVersionIndex['os']['arch']['imageType'] | undefined): CorrettoVersionDetails[] {
        const versions: CorrettoVersionDetails[] = [];

        if (!versionData) return versions;

        for (const versionKey in versionData) {
            const versionEntry = versionData[versionKey];

            for (const archiveType in versionEntry) {
                const expectedFormat = detectArchiveFormat();
                if (archiveType !== expectedFormat) {
                    continue;
                }

                const releaseDetails = versionEntry[archiveType];
                const extractedVersion = this.extractVersionFromPath(releaseDetails.resource);

                versions.push({
                    checksum: releaseDetails.checksum,
                    checksum_sha256: releaseDetails.checksum_sha256,
                    fileType: archiveType,
                    resource: releaseDetails.resource,
                    downloadLink: `https://corretto.aws${releaseDetails.resource}`,
                    version: versionKey,
                    correttoVersion: extractedVersion
                });
            }
        }

        return versions;
    }

        protected async fetchJdkArchive(releaseInfo: JdkReleaseInfo): Promise<JdkSetupResult> {
        core.info(`Downloading JDK ${releaseInfo.version} from ${releaseInfo.url}`);
        const downloadedArchive = await tc.downloadTool(releaseInfo.url);

        core.info(`Extracting JDK archive`);
        const extractedDirectory = await unpackJavaArchive(downloadedArchive, detectArchiveFormat());

        const directoryContents = fs.readdirSync(extractedDirectory);
        const jdkDirectory = path.join(extractedDirectory, directoryContents[0]);
        const formattedVersion = this.formatCacheVersionName(releaseInfo.version);

        const cachedJdkPath = await tc.cacheDir(jdkDirectory, this.cachedToolDirectory, formattedVersion, this.systemArchitecture);

        return { version: releaseInfo.version, path: cachedJdkPath };
    }

    private logAvailableVersions(versions: CorrettoVersionDetails[]): void {
        core.startGroup('Print information about available versions');
        console.timeEnd('corretto-retrieve-available-versions');
        console.log(`Available versions: [${versions.length}]`);
        const versionSummary = versions.map(v => `${v.version}: ${v.correttoVersion}`).join(', ');
        console.log(versionSummary);
        core.endGroup();
    }


        private async fetchAvailableReleases(): Promise<CorrettoVersionDetails[]> {
        const osType = this.determinePlatformName();
        const architecture = this.translateArchitecture();
        const packageType = this.distributionType;

        const debugMode = core.isDebug();
        if (debugMode) {
            console.time('corretto-retrieve-available-versions');
        }

        const versionIndexUrl = 'https://corretto.github.io/corretto-downloads/latest_links/indexmap_with_checksum.json';
        const response = await this.httpClient.getJson<CorrettoVersionIndex>(versionIndexUrl);
        const versionData = response.result;

        if (!versionData) {
            throw Error(`Could not fetch latest corretto versions from ${versionIndexUrl}`);
        }

        const platformVersions = versionData?.[osType]?.[architecture]?.[packageType];
        const processedVersions = this.extractPlatformVersions(platformVersions);

        if (debugMode) {
            this.logAvailableVersions(processedVersions);
        }

        return processedVersions;
    }

}

export interface CorrettoVersionIndex {
    [os: string]: {
        [arch: string]: {
            [distributionType: string]: {
                [version: string]: {
                    [fileType: string]: {
                        checksum: string;
                        checksum_sha256: string;
                        resource: string;
                    };
                };
            };
        };
    };
}

export interface CorrettoVersionDetails {
    version: string;
    fileType: string;
    checksum: string;
    checksum_sha256: string;
    resource: string;
    downloadLink: string;
    correttoVersion: string;
}
