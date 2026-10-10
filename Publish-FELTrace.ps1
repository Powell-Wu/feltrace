param([switch]$Refresh)
$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
if (!(Test-Path -LiteralPath 'COPY_APPROVAL.md')) { throw 'The public use/privacy copy still needs its recorded owner confirmation.' }
if ($Refresh) { node scripts/export.mjs; if($LASTEXITCODE -ne 0){throw 'Export failed'} }
node --test tests/*.test.mjs
if($LASTEXITCODE -ne 0){throw 'Public export verification failed'}
node scripts/github.mjs create
if($LASTEXITCODE -ne 0){throw 'Repository preparation failed'}
if(!(Test-Path -LiteralPath '.git')){
 git init --initial-branch=main
 git config user.name Powell-Wu
 $taskAccount=node scripts/github.mjs check | ConvertFrom-Json
 git config user.email ($taskAccount.id.ToString()+'+Powell-Wu@users.noreply.github.com')
 git remote add origin https://github.com/Powell-Wu/feltrace.git
}
if((git remote get-url origin) -ne 'https://github.com/Powell-Wu/feltrace.git'){throw 'Unexpected publication remote'}
git add .github site src scripts tests copy package.json package-lock.json .gitignore README.md LICENSE COPY_APPROVAL.md Publish-FELTrace.ps1
git diff --cached --quiet
if($LASTEXITCODE -ne 0){git commit -m 'feat(pages): publish FELTrace reading snapshot';if($LASTEXITCODE -ne 0){throw 'Commit failed'}}
git push -u origin main
if($LASTEXITCODE -ne 0){throw 'GitHub push failed'}
node scripts/github.mjs pages
if($LASTEXITCODE -ne 0){throw 'Pages configuration failed'}
node scripts/github.mjs deploy
if($LASTEXITCODE -ne 0){throw 'Pages workflow dispatch failed'}
node scripts/github.mjs status
