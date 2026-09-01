import os
import numpy as np
import logging
from typing import Dict, Any, Tuple, Optional
import onnxruntime as ort
from scipy.ndimage import gaussian_filter

logger = logging.getLogger(__name__)

def calculate_psnr(img1: np.ndarray, img2: np.ndarray) -> float:
    """
    Calculates Peak Signal-to-Noise Ratio (PSNR) between two image arrays in range [0, 1].
    """
    mse = np.mean((img1 - img2) ** 2)
    if mse == 0:
        return 100.0
    return float(-10.0 * np.log10(mse))

def calculate_ssim(img1: np.ndarray, img2: np.ndarray) -> float:
    """
    Calculates the Structural Similarity Index (SSIM) between two arrays.
    """
    mu_x = np.mean(img1)
    mu_y = np.mean(img2)
    
    var_x = np.var(img1)
    var_y = np.var(img2)
    cov_xy = np.mean((img1 - mu_x) * (img2 - mu_y))
    
    # Constants for stability with L=1.0 (reflectance range [0, 1])
    c1 = 0.0001
    c2 = 0.0009
    
    numerator = (2 * mu_x * mu_y + c1) * (2 * cov_xy + c2)
    denominator = (mu_x**2 + mu_y**2 + c1) * (var_x + var_y + c2)
    
    return float(numerator / max(denominator, 1e-6))

class CloudReconstructor:
    def __init__(self, model_path: Optional[str] = None):
        if not model_path:
            # Default to placeholder path
            base_dir = os.path.dirname(os.path.abspath(__file__))
            model_path = os.path.join(base_dir, "placeholder.onnx")
            
        self.model_path = model_path
        self.session = None
        
        if os.path.exists(model_path):
            try:
                self.session = ort.InferenceSession(model_path)
                logger.info("Loaded ONNX reconstruction model from %s", model_path)
            except Exception as e:
                logger.warning("Failed to initialize ONNX session: %s. Using mock interpolation.", e)
        else:
            logger.warning("Model file not found at %s. Using mock reconstruction.", model_path)

    def reconstruct(
        self,
        cloudy_optical: np.ndarray, # [4, H, W]
        sar_guidance: np.ndarray,   # [2, H, W]
        prior_clear: np.ndarray,    # [4, H, W]
        cloud_mask: np.ndarray      # [H, W] - 1=clear, 0=cloud
    ) -> Tuple[np.ndarray, float, float, bool]:
        """
        Reconstructs cloud-blocked optical pixels using conditional U-Net.
        Inputs are stacked into 10-channel tensor.
        Returns: (reconstructed_optical [4, H, W], psnr, ssim, low_quality_flag)
        """
        # Ensure correct float32 precision
        cloudy_opt = cloudy_optical.astype(np.float32)
        sar_guid = sar_guidance.astype(np.float32)
        prior = prior_clear.astype(np.float32)
        mask = cloud_mask.astype(np.float32)
        
        h, w = mask.shape
        
        # Check if ONNX model session is initialized
        if self.session:
            try:
                # Prepare 10 channels input tensor [1, 10, H, W]
                input_data = np.concatenate([cloudy_opt, sar_guid, prior], axis=0)
                input_tensor = np.expand_dims(input_data, axis=0) # Add batch dimension
                
                # Mock time embedding input [1, 1]
                t_tensor = np.array([[0.5]], dtype=np.float32)
                
                inputs = {
                    self.session.get_inputs()[0].name: input_tensor,
                    self.session.get_inputs()[1].name: t_tensor
                }
                
                outputs = self.session.run(None, inputs)
                reconstructed = outputs[0][0] # Remove batch dimension
                
                # Apply mask: keep original clear pixels, replace cloudy pixels
                # 1 = clear (keep cloudy_opt), 0 = cloudy (use reconstructed)
                mask_4ch = np.stack([mask] * 4, axis=0)
                output = cloudy_opt * mask_4ch + reconstructed * (1.0 - mask_4ch)
                
            except Exception as e:
                logger.error("ONNX inference failed: %s. Falling back to mock interpolation.", e)
                output = self._mock_interpolate(cloudy_opt, sar_guid, prior, mask)
        else:
            output = self._mock_interpolate(cloudy_opt, sar_guid, prior, mask)
            
        # Apply gentle Gaussian smoothing to blend reconstruction borders
        for c in range(4):
            # Smooth only the reconstructed (previously cloudy) regions
            smoothed_band = gaussian_filter(output[c], sigma=1.0)
            output[c] = np.where(mask == 0, smoothed_band, output[c])
            
        output = np.clip(output, 0.0, 1.0)
        
        # Compute quality metrics against the prior clear image
        psnr = calculate_psnr(output, prior)
        ssim = calculate_ssim(output, prior)
        
        # Quality gates: PSNR > 30, SSIM > 0.85
        low_quality = (psnr < 30.0) or (ssim < 0.85)
        
        return output, psnr, ssim, low_quality

    def _mock_interpolate(
        self,
        cloudy_optical: np.ndarray,
        sar_guidance: np.ndarray,
        prior_clear: np.ndarray,
        mask: np.ndarray
    ) -> np.ndarray:
        """
        Fallback SAR-guided interpolation:
        Replaces cloudy pixels with a blended combination of the prior clear image
        and SAR backscatter structure.
        """
        logger.warning("Using mock reconstruction — replace with trained model")
        
        mask_4ch = np.stack([mask] * 4, axis=0)
        
        # Build structural guide from SAR (VV and VH normalized average)
        sar_structure = (sar_guidance[0] + sar_guidance[1]) / 2.0
        # Standardize to local contrast
        sar_structure = (sar_structure - np.mean(sar_structure)) / max(np.std(sar_structure), 1e-4)
        sar_structure = np.clip((sar_structure + 2.0) / 4.0, 0.0, 1.0) # Map to [0, 1]
        
        # Reconstruct by blending prior clear image with SAR structural guidance details
        sar_guided_prior = np.zeros_like(prior_clear)
        for c in range(4):
            sar_guided_prior[c] = prior_clear[c] * 0.85 + sar_structure * 0.15
            
        # Fill in clouds
        reconstructed = cloudy_optical * mask_4ch + sar_guided_prior * (1.0 - mask_4ch)
        return reconstructed
