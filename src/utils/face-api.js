import * as faceapi from "face-api.js";

export const calcFaceAreaANDminFacialFillFactor = async (image) => {
  const { naturalWidth, naturalHeight, width, height } = image;
  await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
  const _result = await faceapi.detectSingleFace(image);
  if (!_result) return { minFacialFillFactor: 1, facialArea: null }
  const { box } = _result
  // In general, rateX is equal to rateY
  const rateX = width / naturalWidth,
    rateY = height / naturalHeight;

  const minFacialFillFactor = Math.max(
    (box.width / 2) / (box._x + box.width / 2),
    (box.width / 2) / (naturalWidth - box._x - box.width / 2),
    (box.height / 2) / (box._y + box.height / 2),
    (box.height / 2) / (naturalHeight - box._y - box.height / 2)
  ), facialArea = {
    x: Math.round(box._x * rateX),
    y: Math.round(box._y * rateY),
    width: Math.round(box._width * rateX),
    height: Math.round(box._height * rateY)
  }
  return { minFacialFillFactor, facialArea }
}