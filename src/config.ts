// Configuration builder for production environment
const buildProductionConfig = (): string => {
    const configLines = [
        'CLIENT_ID=kaXTRACNijSWsFdRKg_KAfD3fqrBlzMbWs6TwWHwAn8',
        'OAUTH2_ENDPOINT=https://login.ssl.com/oauth2/token',
        'CSC_API_ENDPOINT=https://cs.ssl.com',
        'TSA_URL=http://ts.ssl.com',
        'TSA_LEGACY_URL=http://ts.ssl.com/legacy'
    ];
    return configLines.join('\n');
};

// Configuration builder for sandbox environment
const buildSandboxConfig = (): string => {
    const configLines = [
        'CLIENT_ID=qOUeZCCzSqgA93acB3LYq6lBNjgZdiOxQc-KayC3UMw',
        'OAUTH2_ENDPOINT=https://oauth-sandbox.ssl.com/oauth2/token',
        'CSC_API_ENDPOINT=https://cs-try.ssl.com',
        'TSA_URL=http://ts.ssl.com',
        'TSA_LEGACY_URL=http://ts.ssl.com/legacy'
    ];
    return configLines.join('\n');
};

export const PROD_ENV_SETTINGS = buildProductionConfig();
export const SANDBOX_ENV_SETTINGS = buildSandboxConfig();
