Write-Host "🚀 Starting Docker Push..."
docker login -u lokesh3328
Write-Host "📦 Pushing Backend..."
docker push lokesh3328/whatsapp-backend:latest
Write-Host "📦 Pushing Frontend..."
docker push lokesh3328/whatsapp-frontend:latest
Write-Host "✨ Done!"
