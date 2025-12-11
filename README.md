# step-security/esigner-codesign

GitHub Action for SSL code signing with enhanced security features. Sign executables, libraries, scripts, and packages with EV code signing certificates.

---

## 🚀 Quick Start

```yaml
- name: Code Signing with CodeSignTool
  uses: step-security/esigner-codesign@v1
  with:
    command: sign
    username: ${{ secrets.ES_USERNAME }}
    password: ${{ secrets.ES_PASSWORD }}
    credential_id: ${{ secrets.CREDENTIAL_ID }}
    totp_secret: ${{ secrets.ES_TOTP_SECRET }}
    file_path: ${{ github.workspace }}/artifacts/MyApp.exe
    output_path: ${{ github.workspace }}/signed
```

---

## 📋 Available Commands

The `command` parameter determines the operation to perform:

| Command | Description |
|---------|-------------|
| `sign` | Sign and timestamp a single code object |
| `batch_sign` | Sign multiple code objects using one OTP |
| `get_credential_ids` | List eSigner credential IDs for your account |
| `credential_info` | Display certificate and key information |
| `hash` | Pre-compute hashes for batch signing |
| `batch_sign_hash` | Sign pre-computed hashes |

---

## 🔧 Configuration Parameters

### Required Parameters

```yaml
# Your SSL.com account credentials
username: ${{ secrets.ES_USERNAME }}
password: ${{ secrets.ES_PASSWORD }}

# Certificate credential identifier
credential_id: ${{ secrets.CREDENTIAL_ID }}

# Time-based One-Time Password secret for authentication
# See: https://www.ssl.com/how-to/automate-esigner-ev-code-signing
totp_secret: ${{ secrets.ES_TOTP_SECRET }}

# Operation to execute
command: sign
```

### File and Directory Parameters

```yaml
# Single file signing (for 'sign' command)
file_path: ${{ github.workspace }}/build/application.exe

# Batch signing directory (for 'batch_sign' command)
dir_path: ${{ github.workspace }}/build/artifacts

# Output directory for signed files
output_path: ${{ github.workspace }}/signed-artifacts
```

**Supported File Formats:** `.acm`, `.ax`, `.bin`, `.cab`, `.cpl`, `.dll`, `.drv`, `.efi`, `.exe`, `.mui`, `.ocx`, `.scr`, `.sys`, `.tsp`, `.msi`, `.ps1`, `.ps1xml`, `.js`, `.vbs`, `.wsf`, `.jar`, `.ovf`, `.ova`, `.nupkg`

### Optional Parameters

```yaml
# Enable malware scanning before signing (default: false)
# Prevents signing if malware is detected
malware_block: true

# Replace original file with signed version (default: false)
override: true

# Environment selection (default: PROD)
# Options: PROD (production), TEST (sandbox/demo)
environment_name: PROD

# Remove log files after signing (default: true)
clean_logs: true

# JVM memory allocation (default: 2048M)
jvm_max_memory: 1024M

# Signing implementation version (default: v1)
# Options: v1, v2
signing_method: v1
```

---

## 💡 Usage Examples

### Example 1: Sign Single Executable

```yaml
name: Sign Windows Application

on:
  push:
    branches: [main]

jobs:
  sign:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Application
        run: dotnet build -c Release

      - name: Sign Executable
        uses: step-security/esigner-codesign@v1
        with:
          command: sign
          username: ${{ secrets.ES_USERNAME }}
          password: ${{ secrets.ES_PASSWORD }}
          credential_id: ${{ secrets.CREDENTIAL_ID }}
          totp_secret: ${{ secrets.ES_TOTP_SECRET }}
          file_path: bin/Release/MyApp.exe
          output_path: signed/
```

### Example 2: Batch Sign Multiple Files

```yaml
- name: Batch Sign JAR Files
  uses: step-security/esigner-codesign@v1
  with:
    command: batch_sign
    username: ${{ secrets.ES_USERNAME }}
    password: ${{ secrets.ES_PASSWORD }}
    credential_id: ${{ secrets.CREDENTIAL_ID }}
    totp_secret: ${{ secrets.ES_TOTP_SECRET }}
    dir_path: build/libs/
    output_path: signed-jars/
    malware_block: true
```

### Example 3: Sign with Malware Protection

```yaml
- name: Secure Code Signing
  uses: step-security/esigner-codesign@v1
  with:
    command: sign
    username: ${{ secrets.ES_USERNAME }}
    password: ${{ secrets.ES_PASSWORD }}
    credential_id: ${{ secrets.CREDENTIAL_ID }}
    totp_secret: ${{ secrets.ES_TOTP_SECRET }}
    file_path: dist/installer.msi
    output_path: signed-dist/
    malware_block: true
    clean_logs: true
```

---

## 🔐 Security Best Practices

1. **Never commit credentials** - Always use GitHub Secrets for sensitive data
2. **Enable malware scanning** - Set `malware_block: true` for production signing
3. **Use production environment** - Set `environment_name: PROD` for release builds
4. **Restrict workflow permissions** - Use least privilege principle for GitHub Actions
5. **Monitor signing activity** - Review SSL.com dashboard for signing operations

---

## 🛠️ Troubleshooting

### Common Issues

**Issue:** `Error: hash needs to be scanned first before submitting for signing`
- **Solution:** Set `malware_block: true` in your workflow configuration

**Issue:** Out of memory errors during signing
- **Solution:** Increase `jvm_max_memory` (e.g., `jvm_max_memory: 2048M`)

**Issue:** Authentication failures
- **Solution:** Verify your TOTP secret is correctly configured following [SSL.com's guide](https://www.ssl.com/how-to/automate-esigner-ev-code-signing)

---

## 📚 Resources

- [SSL.com eSigner Documentation](https://www.ssl.com/esigner/)
- [Automating eSigner EV Code Signing](https://www.ssl.com/how-to/automate-esigner-ev-code-signing)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

---

**Note:** This action requires an active SSL.com eSigner subscription and proper configuration of credentials and TOTP authentication.
