import torch
import torch.nn as nn
import torch.nn.functional as F

class TimeEmbedding(nn.Module):
    def __init__(self, emb_dim: int):
        super().__init__()
        self.lin1 = nn.Linear(1, emb_dim)
        self.lin2 = nn.Linear(emb_dim, emb_dim)
        
    def forward(self, t: torch.Tensor) -> torch.Tensor:
        # t shape: [Batch, 1]
        x = F.silu(self.lin1(t))
        return self.lin2(x)

class DoubleConv(nn.Module):
    def __init__(self, in_ch: int, out_ch: int, emb_dim: int):
        super().__init__()
        self.conv1 = nn.Conv2d(in_ch, out_ch, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(out_ch)
        self.conv2 = nn.Conv2d(out_ch, out_ch, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(out_ch)
        self.emb_proj = nn.Linear(emb_dim, out_ch)
        
    def forward(self, x: torch.Tensor, emb: torch.Tensor) -> torch.Tensor:
        h1 = F.silu(self.bn1(self.conv1(x)))
        # Project time step embedding and add spatially
        emb_out = self.emb_proj(F.silu(emb))[:, :, None, None]
        h2 = F.silu(self.bn2(self.conv2(h1 + emb_out)))
        return h2

class SelfAttention2d(nn.Module):
    def __init__(self, channels: int):
        super().__init__()
        self.channels = channels
        self.mha = nn.MultiheadAttention(embed_dim=channels, num_heads=4, batch_first=True)
        self.ln = nn.LayerNorm([channels])
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        b, c, h, w = x.shape
        x_flat = x.view(b, c, h * w).transpose(1, 2) # Shape: [B, HW, C]
        x_ln = self.ln(x_flat)
        attn_out, _ = self.mha(x_ln, x_ln, x_ln)
        attn_out = attn_out + x_flat
        return attn_out.transpose(1, 2).view(b, c, h, w)

class ConditionalUNet(nn.Module):
    """
    10 Input Channels:
      - 4 Cloudy Optical (R, G, B, NIR)
      - 2 SAR Guidance (VV, VH)
      - 4 Prior Clear Optical (R, G, B, NIR)
    4 Output Channels:
      - 4 Reconstructed Optical (R, G, B, NIR)
    """
    def __init__(self, in_channels: int = 10, out_channels: int = 4, emb_dim: int = 64):
        super().__init__()
        self.time_emb = TimeEmbedding(emb_dim)
        
        # Encoder
        self.inc = DoubleConv(in_channels, 32, emb_dim)
        self.down1 = nn.Sequential(nn.MaxPool2d(2), nn.Dropout2d(0.1))
        self.conv1 = DoubleConv(32, 64, emb_dim)
        self.attn1 = SelfAttention2d(64)
        
        self.down2 = nn.Sequential(nn.MaxPool2d(2), nn.Dropout2d(0.1))
        self.conv2 = DoubleConv(64, 128, emb_dim)
        
        # Decoder
        self.up1 = nn.Upsample(scale_factor=2, mode='bilinear', align_corners=True)
        self.upconv1 = DoubleConv(128 + 64, 64, emb_dim)
        
        self.up2 = nn.Upsample(scale_factor=2, mode='bilinear', align_corners=True)
        self.upconv2 = DoubleConv(64 + 32, 32, emb_dim)
        
        self.outc = nn.Conv2d(32, out_channels, kernel_size=1)
        
    def forward(self, x: torch.Tensor, t: torch.Tensor) -> torch.Tensor:
        emb = self.time_emb(t)
        
        # Downward path
        x1 = self.inc(x, emb)
        x2 = self.down1(x1)
        x2 = self.conv1(x2, emb)
        x2 = self.attn1(x2)
        
        x3 = self.down2(x2)
        x3 = self.conv2(x3, emb)
        
        # Upward path with padding bounds resolution
        x_up = self.up1(x3)
        diff_h = x2.size()[2] - x_up.size()[2]
        diff_w = x2.size()[3] - x_up.size()[3]
        x_up = F.pad(x_up, [diff_w // 2, diff_w - diff_w // 2, diff_h // 2, diff_h - diff_h // 2])
        x_up = torch.cat([x_up, x2], dim=1)
        x_up = self.upconv1(x_up, emb)
        
        x_up = self.up2(x_up)
        diff_h = x1.size()[2] - x_up.size()[2]
        diff_w = x1.size()[3] - x_up.size()[3]
        x_up = F.pad(x_up, [diff_w // 2, diff_w - diff_w // 2, diff_h // 2, diff_h - diff_h // 2])
        x_up = torch.cat([x_up, x1], dim=1)
        x_up = self.upconv2(x_up, emb)
        
        return self.outc(x_up)
