const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

const uploadImage = async (fileBuffer, folder = 'silmin_banana') => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  
  if (cloudName && cloudName !== 'demo_cloud' && process.env.CLOUDINARY_API_KEY) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: folder, resource_type: 'auto' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        }
      );
      uploadStream.end(fileBuffer);
    });
  }

  // Fallback if Cloudinary credentials are default/not set
  const base64Data = fileBuffer.toString('base64');
  return `data:image/png;base64,${base64Data}`;
};

module.exports = {
  cloudinary,
  uploadImage
};
