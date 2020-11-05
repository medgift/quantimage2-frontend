import React, { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react'
import './ChartAnnotationCanvas.css'
import CanvasDraw from 'react-canvas-draw'
import CanvasOptions from './CanvasOptions'

const ChartAnnotationCanvas = (props, ref) => {
    const canvas = useRef(null)
    const [canvasOptions, setCanvasOptions] = useState({
        size: 2,
        color: '#000000',
    })
    const [canvasStyle, setCanvasStyle] = useState(null)

    useEffect(() => {
        setCanvasStyle({
            width: props.image.width,
            height: props.image.height
        })
    }, [props.image])

    const undo = () => {
        canvas.current.undo()
    }

    const updateCanvasOptions = (options) => {
        setCanvasOptions(options)
    }

    useImperativeHandle(ref, () => ({
        clear() {
            canvas.current.clear()     
        },
        getSaveData() {
            return canvas.current.getSaveData()
        },
        loadSaveData(lines, instantly) {
            canvas.current.loadSaveData(lines, instantly)                
        }
    }));

    return (
        <>
            <CanvasOptions
                id={props.image.id} 
                options={canvasOptions} 
                change={updateCanvasOptions} 
                undo={undo}
            />
            <CanvasDraw                 
                ref={canvas}
                lazyRadius={0}
                brushColor={canvasOptions.color}
                brushRadius={canvasOptions.size}
                imgSrc={props.image.raw}
                className='mx-auto'
                style={canvasStyle}
            />
        </>
    )
}

export default forwardRef(ChartAnnotationCanvas)