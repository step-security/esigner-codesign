// Platform identifiers
export const OS_PLATFORM = {
    UNIX_SYSTEM: 'UNIX',
    MAC_OS_SYSTEM: 'MACOS',
    WIN_SYSTEM: 'WINDOWS'
} as const;

// Java configuration for macOS
export const JAVA_MAC_PATH_SUFFIX = 'Contents/Home';

// Tool versioning and paths
const TOOL_VERSION_NUMBER = 'v1.3.0';
export const SIGNING_TOOL_DIR = `CodeSignTool-${TOOL_VERSION_NUMBER}`;

// Signing implementation versions
export const SIGN_METHOD = {
    VERSION_ONE: 'v1',
    VERSION_TWO: 'v2'
} as const;

// Download URLs for different platforms
const BASE_DOWNLOAD_URL = 'https://github.com/SSLcom/CodeSignTool/releases/download';
export const PLATFORM_DOWNLOAD_URLS = {
    windows: `${BASE_DOWNLOAD_URL}/${TOOL_VERSION_NUMBER}/CodeSignTool-${TOOL_VERSION_NUMBER}-windows.zip`,
    unix: `${BASE_DOWNLOAD_URL}/${TOOL_VERSION_NUMBER}/CodeSignTool-${TOOL_VERSION_NUMBER}.zip`
};

// Executable commands
export const EXECUTABLE_SCRIPTS = {
    windows: 'CodeSignTool.bat',
    unix: 'CodeSignTool.sh'
};

// Java command templates
const JAR_FILE_PATH = `code_sign_tool-1.3.0.jar`;
export const JAVA_EXEC_TEMPLATES = {
    windows: `\${{ JAVA_HOME }} -Xmx\${{ JVM_MAX_MEMORY }} -jar \${{ CODE_SIGN_TOOL_PATH }}\\jar\\${JAR_FILE_PATH}`,
    unix: `\${{ JAVA_HOME }} -Xmx\${{ JVM_MAX_MEMORY }} -jar \${{ CODE_SIGN_TOOL_PATH }}/jar/${JAR_FILE_PATH}`
};

// Operation types
export const OPERATIONS = {
    SINGLE_SIGN: 'sign',
    BULK_SIGN: 'batch_sign',
    CODE_SCAN: 'scan_code'
} as const;

// Command parameter mappings
const createCommandParams = (): Map<string, string[]> => {
    const params = new Map<string, string[]>();
    params.set('sign', ['username', 'password', 'credential_id', 'totp_secret', 'program_name', 'file_path', 'output_path', 'malware_block', 'override']);
    params.set('batch_sign', ['username', 'password', 'credential_id', 'totp_secret', 'program_name', 'dir_path', 'output_path']);
    params.set('scan_code', ['username', 'password', 'credential_id', 'program_name']);
    return params;
};
export const COMMAND_PARAMETERS = createCommandParams();

// Input parameter keys
export const INPUT_KEYS = {
    CMD: 'command',
    USER: 'username',
    PASS: 'password',
    CRED_ID: 'credential_id',
    TOTP: 'totp_secret',
    PROGRAM: 'program_name',
    FILE: 'file_path',
    DIR: 'dir_path',
    OUTPUT: 'output_path',
    MALWARE_CHECK: 'malware_block',
    FORCE_OVERRIDE: 'override',
    LOG_CLEANUP: 'clean_logs',
    ENV_NAME: 'environment_name',
    MEMORY_LIMIT: 'jvm_max_memory',
    SIGN_VERSION: 'signing_method'
} as const;

// Environment configurations
export const ENV_CONFIG = {
    PRODUCTION: 'PROD',
    TESTING: 'TEST'
} as const;
