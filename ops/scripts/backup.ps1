param([string]$Out = "backups")
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Path $Out -Force | Out-Null
$file = Join-Path $Out "cloudops-$stamp.archive.gz"
docker exec ops-mongo-1 mongodump --db cloudops --archive=/tmp/b.archive.gz --gzip
docker cp "ops-mongo-1:/tmp/b.archive.gz" $file
docker exec ops-mongo-1 rm /tmp/b.archive.gz
Write-Output "wrote $file"
