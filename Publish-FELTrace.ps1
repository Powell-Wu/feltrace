param([switch]$Refresh,[switch]$PrepareOnly)
$ErrorActionPreference='Stop'
$source=$PSScriptRoot
$runtime=Join-Path $source '.runtime'
$remote='https://github.com/Powell-Wu/feltrace.git'
Push-Location -LiteralPath $source
try {
  if (!(Test-Path -LiteralPath 'COPY_APPROVAL.md')) { throw 'The public copy needs its recorded owner confirmation.' }
  if ($Refresh) { node scripts/export.mjs; if($LASTEXITCODE -ne 0){throw 'Export failed'} }
  npm run test:snapshot
  if($LASTEXITCODE -ne 0){throw 'Public export verification failed'}
  # Keep staging metadata in this independent public repository's ignored runtime directory.
  $candidate=Join-Path $runtime ('public-release-'+[guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $runtime -Force | Out-Null
  git -c http.version=HTTP/1.1 clone --quiet --depth=1 $remote $candidate
  if($LASTEXITCODE -ne 0){throw 'Public checkout failed; source workspace retained'}
  $allowed=@('.github','site','src','scripts','tests','vendor','docs','copy','licenses','package.json','package-lock.json','.gitignore','README.md','LICENSE','COPY_APPROVAL.md','Publish-FELTrace.ps1')
  $candidateFull=[IO.Path]::GetFullPath($candidate)
  foreach($name in $allowed){
    $from=Join-Path $source $name
    if(!(Test-Path -LiteralPath $from)){throw ('Missing reviewed publication input: '+$name)}
    $to=[IO.Path]::GetFullPath((Join-Path $candidateFull $name))
    if(!$to.StartsWith($candidateFull+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Publication target escaped staging checkout'}
    if(Test-Path -LiteralPath $to){Remove-Item -LiteralPath $to -Recurse -Force}
    Copy-Item -LiteralPath $from -Destination $to -Recurse -Force
  }
  Set-Location -LiteralPath $candidateFull
  if((git rev-parse --show-toplevel).Replace('/','\') -ne $candidateFull){throw 'Unexpected publication Git root'}
  if((git remote get-url origin) -ne $remote){throw 'Unexpected publication remote'}
  if($PrepareOnly){Write-Host ('Prepared public candidate: '+$candidateFull);return}
  $taskAccount=node scripts/github.mjs check | ConvertFrom-Json
  git config user.name Powell-Wu
  git config user.email ($taskAccount.id.ToString()+'+Powell-Wu@users.noreply.github.com')
  git add --all
  git diff --cached --quiet
  if($LASTEXITCODE -eq 1){git commit -q -m 'feat(pages): publish FELTrace reading snapshot';if($LASTEXITCODE -ne 0){throw 'Commit failed'}}
  elseif($LASTEXITCODE -ne 0){throw 'Publication diff check failed'}
  git -c http.version=HTTP/1.1 push origin main
  if($LASTEXITCODE -ne 0){throw 'GitHub push failed; candidate retained'}
  node scripts/github.mjs pages
  if($LASTEXITCODE -ne 0){throw 'Pages configuration failed'}
  node scripts/github.mjs deploy
  if($LASTEXITCODE -ne 0){throw 'Pages workflow dispatch failed'}
  node scripts/github.mjs status
} finally {Pop-Location}
