import sys
import traceback

print("--- DIAGNOSTIC START ---")
try:
    import whisperx
    print(f"WhisperX imported. File: {whisperx.__file__}")
    print(f"Available attributes: {dir(whisperx)}")
    
    if hasattr(whisperx, "DiarizationPipeline"):
        print("SUCCESS: DiarizationPipeline found.")
    else:
        print("FAILURE: DiarizationPipeline NOT found in whisperx.")
        
        print("\nAttempting manual import of whisperx.diarize...")
        try:
            from whisperx import diarize
            print("Manual import of 'whisperx.diarize' SUCCEEDED.")
        except Exception as e:
            print(f"Manual import of 'whisperx.diarize' FAILED.")
            traceback.print_exc()

except Exception as e:
    print("CRITICAL: Could not import whisperx.")
    traceback.print_exc()

print("--- DIAGNOSTIC END ---")
