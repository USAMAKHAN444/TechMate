
import React, { useState } from 'react';
import { X, Settings, Globe, Save, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  backendUrl: string;
  onUrlChange: (url: string) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  backendUrl,
  onUrlChange
}) => {
  const [tempUrl, setTempUrl] = useState(backendUrl);
  const [isValidating, setIsValidating] = useState(false);

  const validateAndSaveUrl = async () => {
    if (!tempUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
        variant: "destructive"
      });
      return;
    }

    // Clean up the URL
    let cleanUrl = tempUrl.trim();
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }

    setIsValidating(true);
    
    try {
      // Test the connection with ngrok headers
      const response = await fetch(`${cleanUrl}/chats/`, {
        method: 'GET',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'application/json'
        },
        mode: 'cors',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Check if response looks like our API
        if (data && (data.chat_ids !== undefined || Array.isArray(data.chat_ids))) {
          onUrlChange(cleanUrl);
          localStorage.setItem('chatapp_backend_url', cleanUrl);
          setTempUrl(cleanUrl);
          toast({
            title: "Success",
            description: "Backend URL updated and connection verified!",
          });
          onClose();
        } else {
          throw new Error('Invalid API response format');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error('Connection test failed:', error);
      
      let errorMessage = "Could not connect to the backend.";
      
      if (error.name === 'AbortError') {
        errorMessage = "Connection timeout. Please check the URL and try again.";
      } else if (error.message.includes('CORS')) {
        errorMessage = "CORS error. Make sure your backend allows cross-origin requests.";
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = "Network error. Check if the ngrok tunnel is running and the URL is correct.";
      }
      
      toast({
        title: "Connection Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsValidating(false);
    }
  };

  const resetToDefault = () => {
    setTempUrl('https://4e8287836dc7.ngrok-free.app');
  };

  React.useEffect(() => {
    // Load saved URL from localStorage on mount
    const savedUrl = localStorage.getItem('chatapp_backend_url');
    if (savedUrl) {
      onUrlChange(savedUrl);
      setTempUrl(savedUrl);
    }
  }, [onUrlChange]);

  React.useEffect(() => {
    setTempUrl(backendUrl);
  }, [backendUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm shadow-2xl animate-scale-in">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              <CardTitle>Backend Settings</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription className="text-blue-100">
            Configure your ngrok backend connection
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">Important for ngrok:</p>
                <ul className="text-xs space-y-1">
                  <li>• Make sure your Colab is running</li>
                  <li>• Copy the full ngrok URL (starts with https://)</li>
                  <li>• Don't include trailing slash (/)</li>
                  <li>• Update this URL when ngrok restarts</li>
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="backend-url" className="flex items-center gap-2 font-medium">
                <Globe className="w-4 h-4" />
                Ngrok Backend URL
              </Label>
              <Input
                id="backend-url"
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                placeholder="https://your-id.ngrok-free.app"
                className="bg-white/80 border-gray-200 focus:border-blue-500 focus:bg-white transition-all duration-200 font-mono text-sm"
              />
            </div>

            <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
              <p className="font-medium mb-2">Troubleshooting:</p>
              <ul className="space-y-1">
                <li>• Verify ngrok tunnel is active in Colab</li>
                <li>• Check for 405 errors (CORS issues)</li>
                <li>• Ensure URL format: https://xxxxx.ngrok-free.app</li>
                <li>• No spaces or extra characters in URL</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={validateAndSaveUrl}
              disabled={isValidating || !tempUrl.trim()}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
            >
              {isValidating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save & Test
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={resetToDefault}
              className="border-gray-200 hover:bg-gray-50"
            >
              Reset
            </Button>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500 space-y-2">
              <div>
                <p><strong>Current URL:</strong></p>
                <code className="bg-gray-100 px-2 py-1 rounded text-xs break-all block mt-1">
                  {backendUrl}
                </code>
              </div>
              <div className="text-xs text-blue-600">
                <p>💡 The connection test will check if your backend responds correctly</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPanel;
