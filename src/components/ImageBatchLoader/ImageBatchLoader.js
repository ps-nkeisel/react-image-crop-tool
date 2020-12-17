import React, { useState } from 'react'
import {
  Container,
  Grid,
  Button,
  Typography,
  TextField,
  Slider,
  InputAdornment,
  FormControl,
  FormControlLabel,
  FormLabel,
  Checkbox,
  Radio,
  RadioGroup,
  Box
} from '@material-ui/core'
import CropIcon from '@material-ui/icons/Crop'
import CropFreeIcon from '@material-ui/icons/CropFree'
import CloudUploadIcon from '@material-ui/icons/CloudUpload'
import GetAppIcon from '@material-ui/icons/GetApp'
import CloudDownloadIcon from '@material-ui/icons/CloudDownload'
import NavigateBeforeIcon from '@material-ui/icons/NavigateBefore'
import NavigateNextIcon from '@material-ui/icons/NavigateNext'
import SaveIcon from '@material-ui/icons/Save';
import "@material-ui/core/styles"
import ReactCrop from "react-image-crop"
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import "react-image-crop/dist/ReactCrop.css"
import { calcFaceAreaANDminFacialFillFactor } from '../../utils/face-api'
import _ from "lodash"

import DecimalInputField from '../DecimalInputField'

const KEEP_CROP = 'crop'
const KEEP_FACE = 'face'

const ImageBatchLoader = props => {
  const [imageFiles, setImageFiles] = useState([])
  const [currentImageIndex, setCurrentImageIndex] = useState(-1)
  const [imageFacialAreas, setImageFacialAreas] = useState([])
  const [imageMinFFFs, setImageMinFFFs] = useState([])
  const [imageCrops, setImageCrops] = useState([])
  const [imageFFFs, setImageFFFs] = useState([])
  const [croppedFiles, setCroppedFiles] = useState([])
  const [defaultSize, setDefaultSize] = useState({ width: 0, height: 0})
  const [defaultFFF, setDefaultFFF] = useState(0.3)   // 30%
  const [cachedCrop, setCachedCrop] = useState(undefined)
  const [resolution, setResolution] = useState(100)
  const [keepArea, setKeepArea] = useState(KEEP_CROP)
  const [fixedRatio, setFixedRatio] = useState(true)
  const [allCrop, setAllCrop] = useState(false)
  const [isDetectingFace, setDetectingFace] = useState(false)
  const [imageRef, setImageRef] = useState(undefined)

  const imageCount = imageFiles.length

  const init = () => {
    setImageCrops([])
    setCachedCrop(undefined)
    setCurrentImageIndex(0)
    setImageFiles([])
    setCroppedFiles([])
  }

  const filesUploader = files => {
    const maxSize = 4 * 1000 * 1000
    const minSize = 50 * 1000

    const filteredFiles = Array.from(files).filter(file => {
      if (file.size > maxSize) {
        alert(`${file.name} is greater than 4 MB\n`)
      } else if (file.size < minSize) {
        alert(`${file.name} is less than 50 KB\n`)
      } else {
        return true
      }
      return false
    })

    if (!(filteredFiles && filteredFiles.length && filteredFiles[0])) {
      return
    }

    init()

    setImageFiles(
      filteredFiles.map(file => ({
        name: file.name,
        src: URL.createObjectURL(file)
      }))
    )

    setCroppedFiles(new Array(filteredFiles.length).fill(undefined))
  }

  const scaleCropSize = (oldCrop, newWidth, newHeight) => ({
    x: oldCrop.x - (newWidth - oldCrop.width)/2,
    y: oldCrop.y - (newHeight - oldCrop.height)/2,
    width: newWidth,
    height: newHeight
  })

  const getCroppedImg = (image, crop, fileName) => {
    const canvas = document.createElement("canvas")
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height
    canvas.width = crop.width
    canvas.height = crop.height
    const ctx = canvas.getContext("2d")

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    )

    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
          if (!blob) {
            reject(new Error('Canvas is empty'))
            return
          }
          blob.name = fileName
          const fileUrl = window.URL.createObjectURL(blob)
          resolve({ blob, fileUrl })
        },
        "image/jpeg",
        resolution * 1
      )
    })
  }

  const detectFaceAreaAndMinFFF = async (image) => {
    setDetectingFace(true)
    const { minFacialFillFactor, facialArea } = await calcFaceAreaANDminFacialFillFactor(image)

    imageFacialAreas[currentImageIndex] = facialArea
    setImageFacialAreas(imageFacialAreas)
    imageMinFFFs[currentImageIndex] = minFacialFillFactor
    setImageMinFFFs(imageMinFFFs)

    setDetectingFace(false)
    return { facialArea, minFacialFillFactor }
  }

  const cropArea = async newCrop => {
    const currentCrop = imageCrops[currentImageIndex]

    if (!_.isEqual(newCrop, currentCrop)) {
      const curCrop = Object.assign({}, currentCrop, newCrop)
      const facialArea = imageFacialAreas[currentImageIndex]
      if (curCrop && curCrop.width && curCrop.height && facialArea) {
        imageFFFs[currentImageIndex] = Math.sqrt((facialArea.width * facialArea.height) / (curCrop.width * curCrop.height))
        setImageFFFs(imageFFFs)
      }

      imageCrops[currentImageIndex] = curCrop
      setImageCrops(imageCrops)

      if (!_.isEqual(curCrop, cachedCrop) && curCrop && curCrop.width && curCrop.height) {
        setCachedCrop(curCrop)
      }
    }
  }

  const setFFF = async (value) => {
    let facialArea = imageFacialAreas[currentImageIndex]
    if (!facialArea) {
      if (imageRef) {
        facialArea = (await detectFaceAreaAndMinFFF(imageRef)).facialArea
      } else {
        console.log("Image does not exist!")
        return
      }
    }

    imageFFFs[currentImageIndex] = value
    setImageFFFs(imageFFFs)

    const newWidth = Math.floor(facialArea.width / value),
      newHeight = Math.floor(facialArea.height / value)

    const newCrop = scaleCropSize(facialArea, newWidth, newHeight)
    cropArea(newCrop)
  }

  const onImageLoaded = async image => {
    setImageRef(image)

    if (!imageCrops[currentImageIndex]) {
      let facialArea = imageFacialAreas[currentImageIndex] ?? (await detectFaceAreaAndMinFFF(image)).facialArea

      if (keepArea === KEEP_FACE) {  // crop face
        let newWidth, newHeight
        if (fixedRatio) {
          const WH = facialArea.width * facialArea.height / (defaultFFF * defaultFFF)
          const scale = defaultSize.width / defaultSize.height
          newWidth = Math.sqrt(WH * scale)
          newHeight = Math.sqrt(WH / scale)
        } else {
          newWidth = facialArea.width / defaultFFF
          newHeight = facialArea.height / defaultFFF
        }
        newWidth = Math.round(newWidth)
        newHeight = Math.round(newHeight)
        const newCrop = scaleCropSize(facialArea, newWidth, newHeight)
        cropArea(newCrop)    
      } else {  // copy cached area
        facialArea = scaleCropSize(facialArea, defaultSize.width, defaultSize.height)
        cropArea(facialArea)
      }
    }

    if (allCrop) {
      saveCropAll()
    }
  }

  const onDetectFace = async () => {
    cropArea(imageFacialAreas[currentImageIndex])
  }

  const onSaveDefault = () => {
    const crop = imageCrops[currentImageIndex]
    setDefaultSize({
      width: crop.width,
      height: crop.height
    })
    const fff = imageFFFs[currentImageIndex]
    setDefaultFFF(fff)
  }

  const onPrevious = () => setCurrentImageIndex(currentImageIndex - 1)
  const onNext = () => setCurrentImageIndex(currentImageIndex + 1)

  const onCropSingle = async () => {
    const curCrop = imageCrops[currentImageIndex]
    if (imageRef && curCrop.width && curCrop.height) {
      const newFileName = imageFiles[currentImageIndex].name
      try {
        const croppedImg = await getCroppedImg(
          imageRef,
          curCrop,
          `cropped_${newFileName}`
        )

        setCroppedFiles([
          ...croppedFiles.slice(0, currentImageIndex),
          croppedImg,
          ...croppedFiles.slice(currentImageIndex + 1)
        ])
      } catch (err) {
        console.error(err)
      }
    }
  }

  const onCropAll = async () => {
    setAllCrop(true)
    if (currentImageIndex === 0) {
      saveCropAll()
    } else {
      setCurrentImageIndex(0)
    }
  }

  const saveCropAll = () => {
    setTimeout(async () => {
      await onCropSingle()

      setTimeout(() => {
        if (currentImageIndex < imageCount - 1) {
          onNext()
        } else {
          setAllCrop(false)
          setCurrentImageIndex(0)
        }
      }, 1000)
    }, 500)
  }

  const onDownloadSingle = () => {
    saveAs(croppedFiles[currentImageIndex].blob)
  }

  const onDownloadAll = async () => {
    const zip = new JSZip()
    for (const croppedFile of croppedFiles) {
      await zip.file(croppedFile.blob.name, croppedFile.blob)
    }

    zip.generateAsync({ type: 'blob' })
      .then(content => saveAs(content, 'croppedImages.zip'))
  }

  return (
    <Container>
      <Grid container direction="row" spacing={6}>
        <Grid item xs={3}>
          <Box mb="24px" textAlign="center">
            <Grid className="button" item>
              <input type="file" accept="image/*" multiple id="contained-button-file" className="d-none"
                onChange={e => filesUploader(e.currentTarget.files)}
              />
              <label htmlFor="contained-button-file">
                <Button variant="contained" color="primary" component="span"
                  startIcon={<CloudUploadIcon />}
                  disabled={!(defaultSize.width && defaultSize.height)}
                >Upload image files</Button>
              </label>
            </Grid>
          </Box>
          <FormControl component="fieldset">
            <FormLabel component="legend">Default Configuration</FormLabel>
            <RadioGroup row value={keepArea} onChange={e => setKeepArea(e.target.value)}>
              <FormControlLabel value={KEEP_CROP} label="Crop Area" control={<Radio color="primary" />} />
              <FormControlLabel value={KEEP_FACE} label="Face Area" control={<Radio color="primary" />} />
            </RadioGroup>
            { keepArea === KEEP_CROP ? (
              <Grid container direction="row" spacing={4}>
                <Grid item xs={6}>
                  <TextField type="number" label="Width (px)" margin="normal"
                    InputLabelProps={{ shrink: true }}
                    value={defaultSize.width}
                    onChange={e => 
                      setDefaultSize({
                        ...defaultSize,
                        width: e.currentTarget.value - 0
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField type="number" label="Height (px)" margin="normal"
                    InputLabelProps={{ shrink: true }}
                    value={defaultSize.height}
                    onChange={e => 
                      setDefaultSize({
                        ...defaultSize,
                        height: e.currentTarget.value - 0
                      })
                    }
                  />
                </Grid>
              </Grid>
            ):(
              <>
                <Grid container direction="row" alignItems="flex-end" spacing={1}>
                  <Grid item xs={6}>
                    <DecimalInputField label="Facial Fill Factor: " margin="normal"
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        inputProps: { step: 0.1 },
                        endAdornment: <InputAdornment position="end">%</InputAdornment>
                      }}
                      value={defaultFFF * 100}
                      onChange={e => setDefaultFFF((e.currentTarget.value - 0)/100)}
                      precision={1}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={<Checkbox color="primary" checked={fixedRatio} onChange={e => setFixedRatio(e.target.checked)} />}
                      label="Fix ratio"
                    />
                  </Grid>
                </Grid>
                { fixedRatio && (
                  <Grid container direction="row" spacing={4}>
                    <Grid item xs={6}>
                      <TextField type="number" label="Width (px)" margin="normal"
                        InputLabelProps={{ shrink: true }}
                        value={defaultSize.width}
                        onChange={e => 
                          setDefaultSize({
                            ...defaultSize,
                            width: e.currentTarget.value - 0
                          })
                        }
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField type="number" label="Height (px)" margin="normal"
                        InputLabelProps={{ shrink: true }}
                        value={defaultSize.height}
                        onChange={e => 
                          setDefaultSize({
                            ...defaultSize,
                            height: e.currentTarget.value - 0
                          })
                        }
                      />
                    </Grid>
                  </Grid>
                )}
              </>
            )}
          </FormControl>
          <Box my="24px" textAlign="center">
            <Button variant="contained" color="primary"
              startIcon={<CropFreeIcon />}
              onClick={onDetectFace}
              disabled={!imageRef || isDetectingFace}
            >Detect Face</Button>
          </Box>
          <Box mb="12px">
            <Grid container direction="row" spacing={4}>
              <Grid item xs={6}>
                <TextField type="number" label="Position-X (px)" margin="normal"
                  InputLabelProps={{ shrink: true }}
                  value={imageCrops[currentImageIndex] ? imageCrops[currentImageIndex].x : 0}
                  onChange={e => cropArea({ x: e.currentTarget.value - 0 })}
                  disabled={!imageCrops[currentImageIndex]}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField type="number" label="Position-Y (px)" margin="normal"
                  InputLabelProps={{ shrink: true }}
                  value={imageCrops[currentImageIndex] ? imageCrops[currentImageIndex].y : 0}
                  onChange={e => cropArea({ y: e.currentTarget.value - 0 })}
                  disabled={!imageCrops[currentImageIndex]}
                />
              </Grid>
            </Grid>
            <Grid container direction="row" spacing={4}>
              <Grid item xs={6}>
                <TextField type="number" label="Width (px)" margin="normal"
                  InputLabelProps={{ shrink: true }}
                  value={imageCrops[currentImageIndex] ? imageCrops[currentImageIndex].width : 0}
                  onChange={e => cropArea({ width: e.currentTarget.value - 0 })}
                  disabled={!imageCrops[currentImageIndex]}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField type="number" label="Height (px)" margin="normal"
                  InputLabelProps={{ shrink: true }}
                  value={imageCrops[currentImageIndex] ? imageCrops[currentImageIndex].height : 0}
                  onChange={e => cropArea({ height: e.currentTarget.value - 0 })}
                  disabled={!imageCrops[currentImageIndex]}
                />
              </Grid>
            </Grid>
            <DecimalInputField label="Facial Fill Factor: " margin="normal"
              InputLabelProps={{ shrink: true }}
              InputProps={{
                inputProps: {
                  step: 0.1,
                  min: (imageMinFFFs[currentImageIndex] ?? 0.3) * 100
                },
                endAdornment: <InputAdornment position="end">%</InputAdornment>
              }}
              value={(imageFFFs[currentImageIndex] ? imageFFFs[currentImageIndex] : defaultFFF) * 100}
              onChange={e => setFFF((e.currentTarget.value - 0)/100)}
              disabled={!imageCrops[currentImageIndex]}
              precision={1}
              fullWidth
            />
            <Box my="24px" textAlign="center">
              <Button variant="contained" color="primary"
                startIcon={<SaveIcon />}
                onClick={onSaveDefault}
                disabled={!imageCrops[currentImageIndex]}
              >Save as Default</Button>
            </Box>
          </Box>
        </Grid>
        <Grid item xs={9}>
          <Grid container spacing={5} direction='row' style={{ marginBottom: 8 }}>
            <Grid item xs={4}>
              <Button variant="contained" color="primary" className="w-100"
                startIcon={<CropIcon />}
                onClick={onCropSingle}
                disabled={!imageCrops[currentImageIndex] || imageCrops[currentImageIndex].width <= 0 || imageCrops[currentImageIndex].height <= 0}
              >Crop Single</Button>
            </Grid>
            <Grid item xs={4}>
              <Button variant="contained" color="primary" className="w-100"
                startIcon={<CropFreeIcon />}
                onClick={onCropAll}
                disabled={!imageCrops[0] || imageCrops[0].width <= 0 || imageCrops[0].height <= 0}
              >Crop All</Button>
            </Grid>
            <Grid item xs={2}>
              <Button variant="contained" className="w-100"
                startIcon={<NavigateBeforeIcon />}
                onClick={onPrevious}
                disabled={currentImageIndex <= 0 || !imageCrops[currentImageIndex] || isDetectingFace}
              >Previous</Button>
            </Grid>
            <Grid item xs={2}>
              <Button variant="contained" className="w-100"
                endIcon={<NavigateNextIcon />}
                onClick={onNext}
                disabled={currentImageIndex === imageCount - 1 || !imageCrops[currentImageIndex] || isDetectingFace}
              >Next</Button>
            </Grid>
          </Grid>
          <Grid container spacing={5} direction='row' style={{ marginBottom: 8 }}>
            <Grid item xs={4}>
              <Button variant="contained" color="primary" className="w-100"
                startIcon={<GetAppIcon />}
                onClick={onDownloadSingle}
                disabled={!(croppedFiles.length && croppedFiles[currentImageIndex])}
              >Download Single</Button>
            </Grid>
            <Grid item xs={4}>
              <Button variant="contained" color="primary" className="w-100"
                startIcon={<CloudDownloadIcon />}
                onClick={onDownloadAll}
                disabled={!(croppedFiles.length && croppedFiles.length === imageCount && !croppedFiles.some(file => file === undefined))}
              >Download All</Button>
            </Grid>
            <Grid item xs={4}>
              <Box display="flex" flexDirection="row" justifyContent="space-between" mb="6px">
                <Typography id="input-slider" gutterBottom>Resolution: </Typography>
                <Typography style={{ marginRight: 30 }}><strong>{resolution} %</strong></Typography>
              </Box>
              <Slider aria-labelledby="input-slider"
                { ...{ step: .1, min: 0, max: 100 } }
                value={(resolution).toFixed(2) - 0}
                onChange={(event, v) => setResolution(v)}
              />
            </Grid>
          </Grid>
          <Grid container spacing={3}>
            <Grid item xs={9}>
              <ReactCrop disabled={isDetectingFace} imageStyle={{ width: "100%", height: "100%" }} src={imageFiles[currentImageIndex] && imageFiles[currentImageIndex].src} crop={imageCrops[currentImageIndex]} onImageLoaded={onImageLoaded} onChange={cropArea} />
            </Grid>

            <Grid item container xs={3} justify="center" alignItems="center">
              <img id="overlay" src={croppedFiles.length && croppedFiles[currentImageIndex] ? croppedFiles[currentImageIndex].fileUrl : null} alt="" />
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Container>
  )
}

export default ImageBatchLoader
