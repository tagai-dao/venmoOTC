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
  const [errorType, setErrorType] = useState<'permission' | 'not_found' | 'not_allowed' | 'unknown'>('unknown');

  // 检查摄像头权限状态
  const checkCameraPermission = async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorType('not_found');
        setErrorMessage('您的浏览器不支持摄像头访问');
        return false;
      }

      // 检查权限状态（如果浏览器支持）
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (permissionStatus.state === 'denied') {
            setErrorType('permission');
            setErrorMessage('摄像头权限已被拒绝，请在浏览器设置中允许摄像头访问');
            return false;
          }
        } catch (e) {
          // 某些浏览器可能不支持 permissions.query，继续尝试
          console.log('Permission query not supported, continuing...');
        }
      }

      return true;
    } catch (err) {
      console.error('Error checking camera permission:', err);
      return false;
    }
  };

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

  // 启动扫描的核心逻辑
  const attemptStartScanning = async (isMounted: boolean) => {
    try {
      // 先检查权限
      const hasPermission = await checkCameraPermission();
      if (!hasPermission) {
        if (isMounted) {
          setPermissionError(true);
        }
        return;
      }

      console.log('🔍 Starting QR scanner...');
      const html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;

      // 配置扫描选项
      const config = {
        fps: 10,
        qrbox: function(viewfinderWidth: number, viewfinderHeight: number) {
          const minEdgePercentage = 0.7;
          const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
          return { width: qrboxSize, height: qrboxSize };
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
        // 忽略扫描错误，继续扫描
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
            { facingMode: "user" },
            config,
            onScanSuccess,
            onScanError
          );
          if (isMounted) {
            setScanning(true);
            console.log('✅ QR scanner started successfully with front camera');
          }
        } catch (frontCameraError: any) {
          console.warn('⚠️ Front camera failed, trying default camera...', frontCameraError);
          await html5QrCode.start(
            undefined,
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
        
        // 根据错误类型设置更具体的错误信息
        const errorMsg = err.message || err.toString() || '';
        const errorStr = errorMsg.toLowerCase();
        
        if (errorStr.includes('permission') || errorStr.includes('denied') || errorStr.includes('not allowed')) {
          setErrorType('permission');
          setErrorMessage('摄像头权限被拒绝。请在浏览器设置中允许摄像头访问，然后刷新页面重试。');
        } else if (errorStr.includes('not found') || errorStr.includes('no device')) {
          setErrorType('not_found');
          setErrorMessage('未检测到摄像头设备，请确保您的设备已连接摄像头。');
        } else if (errorStr.includes('not readable') || errorStr.includes('could not start')) {
          setErrorType('not_allowed');
          setErrorMessage('摄像头无法启动，可能被其他应用占用。请关闭其他使用摄像头的应用后重试。');
        } else {
          setErrorType('unknown');
          setErrorMessage(err.message || '无法启动摄像头，请检查权限设置和设备连接');
        }
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const startScanning = async () => {
      await attemptStartScanning(isMounted);
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
          <div className="text-white text-center p-6 max-w-md mx-auto">
            <Camera className="w-12 h-12 mx-auto mb-4 text-gray-500" />
            <p className="mb-2 font-bold text-lg">摄像头访问被拒绝或不可用</p>
            {errorMessage && (
              <p className="text-sm text-gray-300 mb-4 leading-relaxed">{errorMessage}</p>
            )}
            
            {/* 根据错误类型显示不同的解决建议 */}
            {errorType === 'permission' && (
              <div className="text-left bg-gray-800/50 rounded-lg p-4 mb-4 text-xs text-gray-300">
                <p className="font-bold mb-2">解决步骤：</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>点击浏览器地址栏左侧的锁图标或信息图标</li>
                  <li>找到"摄像头"或"Camera"权限设置</li>
                  <li>选择"允许"或"Allow"</li>
                  <li>刷新页面后重试</li>
                </ul>
              </div>
            )}
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={async () => {
                  // 重置错误状态并重试
                  setPermissionError(false);
                  setErrorMessage('');
                  setErrorType('unknown');
                  // 先停止之前的扫描（如果有）
                  await stopScanning();
                  // 延迟一点再启动，确保状态已更新
                  setTimeout(() => {
                    attemptStartScanning(true);
                  }, 100);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium"
              >
                重试
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
              >
                关闭
              </button>
            </div>
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
