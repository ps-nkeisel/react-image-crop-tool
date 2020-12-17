import React from "react"
import {
  TextField
} from '@material-ui/core'

const DecimalInputField = (props) => {
  const { value, onChange, precision, ...otherProps } = props

  const [isEditing, setEditing] = React.useState(false)

  const fixedValue = parseFloat(value.toFixed(precision))

  return (
    <>
    {isEditing ? (
      <TextField 
        type="number"
        value={fixedValue}
        onBlur={() => setEditing(false)}
        onChange={onChange}
        {...otherProps}
      />
    ):(
      <TextField 
        type="text"
        value={fixedValue.toFixed(precision)}
        onFocus={() => setEditing(true)}
        readOnly
        {...otherProps}
      />
    )}
    </>
  )
}

DecimalInputField.defaultProps = {
  precision: 0
}

export default DecimalInputField
