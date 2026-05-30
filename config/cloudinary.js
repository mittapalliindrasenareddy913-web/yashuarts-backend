import { v2 as cloudinary } from 'cloudinary';

export const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
};

export const uploadToCloudinary = (fileBuffer, folder = 'yashuarts') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
};

export const deleteFromCloudinary = async (imageUrl) => {
  if (!imageUrl) return;
  try {
    // Extract public_id from Cloudinary URL
    // Format: https://res.cloudinary.com/cloud_name/image/upload/v1234567/folder/image.jpg
    const parts = imageUrl.split('/image/upload/');
    if (parts.length < 2) return;

    const pathAndFilename = parts[1];
    // Remove version prefix if exists (e.g. v1234567/sample.jpg -> sample.jpg)
    const afterVersion = pathAndFilename.replace(/^v\d+\//, '');

    // Remove file extension (e.g. yashuarts/sample.jpg -> yashuarts/sample)
    const publicId = afterVersion.split('.').slice(0, -1).join('.') || afterVersion;

    console.log(`[Cloudinary] Deleting asset with publicId: ${publicId}`);
    const result = await cloudinary.uploader.destroy(publicId);
    console.log('[Cloudinary] Deletion result:', result);
    return result;
  } catch (error) {
    console.error('[Cloudinary] Deletion error:', error);
    throw error;
  }
};

