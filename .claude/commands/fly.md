Deploy the latest code changes to the Fly.io cloud deployment.

## Steps

1. Run `flyctl deploy` from the project root directory (`c:\AI\QC`) to build and deploy the updated Docker image to Fly.io.

**IMPORTANT**: The `flyctl` command may not work in the bash terminal on Windows. If it hangs or fails, provide the user with the PowerShell command to run manually:

```powershell
cd c:\AI\QC
flyctl deploy
```

2. After deployment completes (or the user confirms it completed), let the user know the app is live at: https://qc-inspector-vbp.fly.dev
