import os
import sys
import site
from pathlib import Path

def patch_lightning_fabric():
    print("Searching for lightning_fabric to apply PyTorch 2.6 fix...")
    
    # Locate site-packages
    site_packages_dirs = site.getsitepackages()
    target_file = None
    
    for sp in site_packages_dirs:
        potential_path = Path(sp) / "lightning_fabric" / "utilities" / "cloud_io.py"
        if potential_path.exists():
            target_file = potential_path
            break
            
    if not target_file:
        # Fallback search in venv lib
        venv_lib = Path(sys.prefix) / "Lib" / "site-packages"
        target_file = venv_lib / "lightning_fabric" / "utilities" / "cloud_io.py"
        
    if not target_file or not target_file.exists():
        print(f"[WARNING] Could not find {target_file}. Patch skipped (App might crash).")
        return

    print(f"Patching {target_file}...")
    
    with open(target_file, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Fix Imports
    if "Callable, Dict" not in content:
        content = content.replace(
            "from typing import IO, Any, Optional, Union", 
            "from typing import IO, Any, Callable, Dict, Optional, Union"
        )

    # 2. Fix Function Signature to accept **kwargs
    if "**kwargs" not in content:
        search_sig = 'map_location: Optional[Union[Dict[str, str], str, "torch.device", int, Callable]] = None,'
        replace_sig = 'map_location: Optional[Union[Dict[str, str], str, "torch.device", int, Callable]] = None, **kwargs: Any,'
        content = content.replace(search_sig, replace_sig)

    # 3. Add weights_only=False to torch.load calls
    if "weights_only=False" not in content:
        content = content.replace(
            "return torch.load(path_or_url, map_location=map_location)", 
            "return torch.load(path_or_url, map_location=map_location, weights_only=False)"
        )
        content = content.replace(
            "return torch.load(f, map_location=map_location)", 
            "return torch.load(f, map_location=map_location, weights_only=False)"
        )
        content = content.replace(
            "check_hash=False", 
            "check_hash=False, weights_only=False"
        )

    with open(target_file, "w", encoding="utf-8") as f:
        f.write(content)
        
    print("[SUCCESS] Library patched successfully.")

if __name__ == "__main__":
    patch_lightning_fabric()
