$Volume = "ecobairro_osm-data"
$Profiles = @("car", "bicycle", "foot")

foreach ($Profile in $Profiles) {
    Write-Host "Building OSRM graph for profile: $Profile..."
    
    # Copy PBF
    docker run --rm -v "${Volume}:/data" alpine cp /data/portugal-latest.osm.pbf /data/${Profile}.osm.pbf
    
    # Extract
    Write-Host "Extracting $Profile..."
    docker run --rm -v "${Volume}:/data" osrm/osrm-backend osrm-extract -p /opt/${Profile}.lua /data/${Profile}.osm.pbf
    
    # Partition
    Write-Host "Partitioning $Profile..."
    docker run --rm -v "${Volume}:/data" osrm/osrm-backend osrm-partition /data/${Profile}.osrm
    
    # Customize
    Write-Host "Customizing $Profile..."
    docker run --rm -v "${Volume}:/data" osrm/osrm-backend osrm-customize /data/${Profile}.osrm
    
    # Clean up PBF
    docker run --rm -v "${Volume}:/data" alpine rm /data/${Profile}.osm.pbf
}

Write-Host "Starting OSRM containers..."
cd infra/compose
docker compose up -d osrm-car osrm-bike osrm-foot
