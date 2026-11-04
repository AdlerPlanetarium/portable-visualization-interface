#!/bin/bash

# Loop through all .avi files in the current directory
for file in ../bkup/media/*; do
    # Check if files actually exist to avoid errors
    [ -e "$file" ] || continue
    
    # Extract filename without the extension
    filename=$(basename "${file%.*}")
    
    echo "Processing: $filename"
    
    # Run FFmpeg conversion
    ffmpeg -i "$file" -vcodec libx264 -acodec aac -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" "/home/astrouser/cart-media-appliance/public/media/${filename}.mp4"
done

echo "All conversions completed!"
