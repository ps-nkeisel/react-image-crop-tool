import React from 'react'
import {
  Typography,
  Box
} from '@material-ui/core'
import './sass/index.scss'
import ImageBatchLoader from './components/ImageBatchLoader/ImageBatchLoader'

const App = () => (
  <Box p="30px">
    <Typography variant="h4" component="h4" align="center" style={{ marginBottom: 30 }}>Image Cropping Service</Typography>
    <ImageBatchLoader/>
  </Box>
)

export default App
