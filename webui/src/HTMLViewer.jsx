import React, { useState, useRef, useEffect, useMemo } from 'react';

export default function HTMLViewer({ rawHtml }) {
  const [iframeHeight, setIframeHeight] = useState('20px');
  const iframeRef = useRef(null);

  // Generate a strictly unique ID for this specific component instance
  const instanceId = useMemo(() => {
    return typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `frame-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`;
  }, []);

  // Wrap raw HTML and inject the unique instance ID into the event message payload
  const generateSandboxedSrcDoc = (htmlContent, id) => {
    const isFullPage = /<html[^>]*>/i.test(htmlContent);

    const bodyContent = isFullPage
      ? htmlContent
      : `<div>${htmlContent}</div>`;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 0; overflow: hidden; }
          </style>
        </head>
        <body>
          ${bodyContent}
          <script>
            window.addEventListener('DOMContentLoaded', () => {
              const observer = new ResizeObserver((entries) => {
                for (let entry of entries) {
                  const height = document.documentElement.scrollHeight;
                  // Critical Fix: Pass the unique instance ID back to the parent
                  window.parent.postMessage({
                    type: 'RESIZE_IFRAME',
                    id: '${id}',
                    height: height
                  }, '*');
                }
              });
              observer.observe(document.body);

              const initialHeight = document.documentElement.scrollHeight;
              window.parent.postMessage({
                type: 'RESIZE_IFRAME',
                id: '${id}',
                height: initialHeight
              }, '*');
            });
          </script>
        </body>
      </html>
    `;
  };

  useEffect(() => {
    const handleMessage = (event) => {
      // Critical Fix: Only process the event if the ID matches this component's unique instanceId
      if (event.data && event.data.type === 'RESIZE_IFRAME' && event.data.id === instanceId) {
        setIframeHeight(`${event.data.height}px`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [instanceId]); // Dependency array ensures listener locks onto this specific ID

  return (
    <iframe
      ref={iframeRef}
      title={`User Content Container ${instanceId}`}
      srcDoc={generateSandboxedSrcDoc(rawHtml, instanceId)}
      sandbox="allow-scripts"
      style={{
        width: '100%',
        height: iframeHeight,
        border: 'none',
        transition: 'height 0.15s ease-out'
      }}
    />
  );
}
