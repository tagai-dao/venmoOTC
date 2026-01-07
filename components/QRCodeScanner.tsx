import React, { useEffect, useRef, useState } from 'react';
import { X, Camera } from 'lucide-react';

interface Props {
  onClose: () => void;
  onScan: (data: string) => void;
}

const QRCodeScanner: React.FC<Props> = ({ onClose, onScan }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera error:", err);
        setPermissionError(true);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
        <h2 className="text-white font-bold text-lg">Scan Code</h2>
        <button onClick={onClose} className="bg-white/20 p-2 rounded-full text-white backdrop-blur-sm">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-gray-900">
        {!permissionError ? (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="absolute w-full h-full object-cover opacity-80"
          />
        ) : (
          <div className="text-white text-center p-6">
            <Camera className="w-12 h-12 mx-auto mb-4 text-gray-500" />
            <p>Camera access denied or unavailable.</p>
          </div>
        )}
        
        {/* Scanner Overlay */}
        <div className="relative z-10 w-64 h-64 border-2 border-blue-500 rounded-2xl flex items-center justify-center shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 animate-pulse bg-blue-500/10"></div>
        </div>
      </div>

      <div className="p-8 bg-black flex flex-col items-center gap-4">
        <p className="text-gray-400 text-sm text-center">Align QR code within the frame to pay</p>
        <button 
          onClick={() => onScan("0x123...SimulatedScan")}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition"
        >
          Simulate Successful Scan
        </button>
      </div>
    </div>
  );
};

export default QRCodeScanner;
