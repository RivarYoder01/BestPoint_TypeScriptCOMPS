// TypeScript version of the Python script with GitHub Secrets support
// Author: Rivar Yoder
// Version: 1.0
// Date: 2025.06.02
// Status: Development

import axios from 'axios'; // Importing axios for HTTP requests
import * as dotenv from 'dotenv'; // Importing dotenv to manage environment variables
dotenv.config(); // Load environment variables from .env file
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SITE_URL = 'https://bestpointwebdesign.com/wp-json/wp/v2/media'; // Testing site URL

async function compressedImageToWP(imagePath: string, imageId: number): Promise<void> {
    /**
    Function receives the alt text from ChatGPT. It starts by pulling the REST API credentials from GitHub secrets and
    storing them as auth. It then prepares the payload with the alt text and headers for the request. Finally,
        it sends a POST request to the WordPress API to update the alt text for the image.
    */

    const wpUsername = process.env.WP_USERNAME; // WordPress username from environment variables
    const wpPassword = process.env.WP_PASSWORD; // WordPress password from environment variables

    if (!wpUsername || !wpPassword) { // If credentials are not available
        console.error('Missing WordPress credentials.');
        process.exit(1);
    }

    const updateUrl = `${SITE_URL}/${imageId}`; //
    const imageBuffer = fs.readFileSync(imagePath); // Read the image file from the provided path
    const fileName = imagePath.split(/[\\/]/).pop();

    try {
        const response = await axios.post(updateUrl, imageBuffer, {
            headers: {
                'Content-Type': 'image/png',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
            auth: {
                username: wpUsername,
                password: wpPassword,
            },
        });

        if (response.status === 200) {
            console.log('Image replaced successfully.');
            console.log('-----------------------------------------------------------------------------------------------');
            return;
        } else {
            console.error(`Failed to replace image: ${response.status} ${response.statusText}`);
            console.log('-----------------------------------------------------------------------------------------------');
            process.exit(1);
        }
    } catch (error: any) {
        console.error('Error replacing image in WordPress:', error.message);
        console.log('-----------------------------------------------------------------------------------------------');
        process.exit(1);
    }
}

async function compressImage(imageUrl: string, imageId: number): Promise<void> {
    /**
     * Takes in pulled_images as a list, using load_dotenv() to pull the API key from .env file. OS is used to access
     *     ChatGPT with that key.
     *
     *     The Prompt: Generate alternative text for this image that is no longer than 150 characters long. Do not give any
     *                 other text and clear all formatting. Describe the image's purpose, essential information, only include
     *                 what is relevant to a sighted user. Use natural language, no abbreviations or jargon. Avoid phrases
     *                 like 'click here' and 'image of'. End with a period.
     *
     *     Image URL: Pulled from pull_wp_images
     *
     *     FOR NOW: Prints result from Chatgpt, will soon pass into a function to pass alt text into WordPress
     */

    try {
        const ext = path.extname(imageUrl); // Get the file extension
        const base = imageUrl.replace(ext, ''); // Remove the extension from the URL to create a base name
        const compressedPath = `${base}.compressed${ext}`; // Create a new path for the compressed image
        console.log(compressedPath);
        console.log(imageId);

        // Compress to a new file
        await sharp(imageUrl) // Load the image from the provided URL
            .toFormat(ext === '.png' ? 'png' : 'jpeg', { quality: 80 }) // Convert to PNG or JPEG with quality 80
            .toFile(compressedPath); // Save the compressed image to the new path

        await compressedImageToWP(compressedPath, imageId);

        // Optionally, overwrite the original
        // fs.renameSync(compressedPath, imageUrl);
    } catch (error: any) {
        console.error('Unexpected error occurred when compressing image: ', error.message);
        console.log('-----------------------------------------------------------------------------------------------');
        process.exit(1);
    }
}

async function pullWpImages(): Promise<void> {
    /**
     * Function accesses provided URL and IF the request is successful, the program reads the file and pulls the image's
     * urls with a FOR LOOP.
     */
    try {
        const response = await axios.get(SITE_URL); // Getting images from WordPress REST API
        const allowedTypes = ['png', 'jpeg']; // Allowed image types
        const pulledImages: string[] = []; // Array to store pulled image URLs
        const imageIds: number[] = []; // Array to store image IDs

        for (const image of response.data) { // Looping through each image in the response
            if (
                image.media_type === 'image' && // Check if media type is image
                allowedTypes.some(type => image.mime_type.endsWith(type))
            ) {
                imageIds.push(image.id); // Store the image ID
                pulledImages.push(image.source_url); // Store the image URL
            } else { // If the image type is not allowed, skip it
                console.log(`Skipped - This image does not need to be compressed: ${image.source_url}`);
                console.log('-----------------------------------------------------------------------------------------------');
            }
        }

        if (pulledImages.length > 0) { // If there are images to process
            for (let i = 0; i < pulledImages.length; i++) { // Loop through each pulled image
                await compressImage(pulledImages[i], imageIds[i]); // Generate alt text for each image
            }
        } else { // If no images were found, log a message and end the program
            console.log('No images found.');
            console.log('-----------------------------------------------------------------------------------------------');
            process.exit(0)
        }
    } catch (error: any) { // If any error occur, end the program
        console.error('Error fetching images:', error.message);
        console.log('-----------------------------------------------------------------------------------------------');
        process.exit(1);
    }
}

async function main(): Promise<void> {
    await pullWpImages(); // starts pulling images from WordPress
    console.log('-----------------------------------------------------------------------------------------------');
    console.log('All images processed successfully.');
    process.exit(0); // Exit the program
}

main();