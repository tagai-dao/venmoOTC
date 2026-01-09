import React, { useEffect, useRef, useState } from 'react';
import { X, Camera } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface Props {
  onClose: () => void;
  onScan: (data: string) => void;
}

const QRCodeScanner: React.FC<Props> = ({ onClose, onScan }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        console.log('🛑 Stopping QR scanner...');
        await scannerRef.current.stop();
        await scannerRef.current.clear();
        scannerRef.current = null;
        setScanning(false);
        console.log('✅ QR scanner stopped');
      } catch (err) {
        console.error("❌ Error stopping scanner:", err);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const startScanning = async () => {
      try {
        console.log('🔍 Starting QR scanner...');
        const html5QrCode = new Html5Qrcode("qr-reader");
        scannerRef.current = html5QrCode;

        // 配置扫描选项 - 使用更宽松的配置以提高识别率
        const config = {
          fps: 10,
          qrbox: function(viewfinderWidth: number, viewfinderHeight: number) {
            // 动态计算扫描框大小，使用屏幕的 70%
            const minEdgePercentage = 0.7;
            const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
            const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
            return {
              width: qrboxSize,
              height: qrboxSize
            };
          },
          aspectRatio: 1.0,
          disableFlip: false
        };

        // 扫描成功回调
        const onScanSuccess = (decodedText: string, decodedResult: any) => {
          console.log('✅ QR Code scanned:', decodedText);
          if (isMounted) {
            stopScanning();
            onScan(decodedText);
            onClose();
          }
        };

        // 扫描错误回调（忽略，继续扫描）
        const onScanError = (errorMessage: string) => {
          // 只在调试时输出错误
          // console.log('Scan error (ignored):', errorMessage);
        };

        // 尝试启动扫描器：先尝试后置摄像头，失败则尝试前置摄像头
        try {
          console.log('📷 Trying rear camera (environment)...');
          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanError
          );
          if (isMounted) {
            setScanning(true);
            console.log('✅ QR scanner started successfully with rear camera');
          }
        } catch (rearCameraError: any) {
          console.warn('⚠️ Rear camera failed, trying front camera...', rearCameraError);
          try {
            await html5QrCode.start(
              { facingMode: "user" }, // 前置摄像头
              config,
              onScanSuccess,
              onScanError
            );
            if (isMounted) {
              setScanning(true);
              console.log('✅ QR scanner started successfully with front camera');
            }
          } catch (frontCameraError: any) {
            // 如果前置摄像头也失败，尝试使用默认摄像头
            console.warn('⚠️ Front camera failed, trying default camera...', frontCameraError);
            await html5QrCode.start(
              undefined, // 使用默认摄像头
              config,
              onScanSuccess,
              onScanError
            );
            if (isMounted) {
              setScanning(true);
              console.log('✅ QR scanner started successfully with default camera');
            }
          }
        }
      } catch (err: any) {
        console.error("❌ Scanner error:", err);
        if (isMounted) {
          setPermissionError(true);
          setErrorMessage(err.message || '无法启动摄像头，请检查权限设置');
        }
      }
    };

    // 延迟一点启动，确保 DOM 已渲染
    const timer = setTimeout(() => {
      startScanning();
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopScanning();
    };
  }, []); // 移除依赖项，避免重复初始化

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
          <div 
            id="qr-reader" 
            className="w-full h-full"
            style={{ position: 'relative' }}
          />
        ) : (
          <div className="text-white text-center p-6">
            <Camera className="w-12 h-12 mx-auto mb-4 text-gray-500" />
            <p className="mb-2">摄像头访问被拒绝或不可用</p>
            {errorMessage && <p className="text-sm text-gray-400">{errorMessage}</p>}
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
            >
              关闭
            </button>
          </div>
        )}
      </div>

      <div className="p-6 bg-black flex flex-col items-center gap-3">
        <p className="text-gray-400 text-sm text-center">
          {scanning ? '将二维码对准扫描框' : '正在启动摄像头...'}
        </p>
        <button 
          onClick={onClose}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2.5 rounded-xl transition"
        >
          取消
        </button>
      </div>
    </div>
  );
};

export default QRCodeScanner;
