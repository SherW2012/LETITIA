let detector;
self.onmessage=async ({data})=>{
  try {
    if(data.type==='init') {
      const { FilesetResolver, ObjectDetector }=await import('/vendor/mediapipe/vision_bundle.mjs');
      const vision=await FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm');
      detector=await ObjectDetector.createFromOptions(vision,{
        baseOptions:{modelAssetPath:'/models/efficientdet-lite0.tflite',delegate:'CPU'},
        runningMode:'VIDEO',categoryAllowlist:['person'],scoreThreshold:0.25,maxResults:8
      });
      self.postMessage({type:'ready'});
    } else if(data.type==='frame') {
      const {bitmap,now}=data;
      try {
        const result=detector.detectForVideo(bitmap,now);
        const people=result.detections.map(d=>({x:d.boundingBox.originX/bitmap.width,y:d.boundingBox.originY/bitmap.height,w:d.boundingBox.width/bitmap.width,h:d.boundingBox.height/bitmap.height,score:d.categories[0].score}));
        self.postMessage({type:'result',people,now});
      } finally { bitmap.close(); }
    }
  } catch(error) { self.postMessage({type:'error',message:String(error.message||error)}); }
};
