import React from 'react'
import { Button, Input, Col, Label, InputGroup, InputGroupAddon } from 'reactstrap'
import { FaSyncAlt } from 'react-icons/fa'
import './ClusterOptions.css' 
import { withFormik } from 'formik'

const ClusterOptions = props => {

    const smallSize = {fontSize: '14px'}

    const update = () => {
        props.handleSubmit(props.values, props)
    }

    return (
        <>
            <Col xs='2' className='text-left'>
                <Label for='number'>
                    <span className='small' style={smallSize}>
                        Nombre de clusters
                    </span>
                </Label>
                <InputGroup>                        
                    <Input type="number" 
                        id="number" 
                        value={props.values.number}
                        onChange={props.handleChange}
                    />
                    <InputGroupAddon addonType="append">
                        <Button color="info" onClick={update} disabled={!props.loaded}>                            
                            <FaSyncAlt />
                        </Button>
                    </InputGroupAddon>
                </InputGroup>
            </Col>
        </>
    )
}

export default withFormik({
    mapPropsToValues: () => ({
        number: 0,
    }),
    handleSubmit: (values, {props}) => {
        if (values.number === null) values.number = 0
        props.save(values.number)
    },
})(ClusterOptions)