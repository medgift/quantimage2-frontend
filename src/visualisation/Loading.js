import React from 'react'
import { Spinner } from 'reactstrap'
import './Loading.scss' 

const Loading = props => {
    return (
        <>
            <div className="Loading">
                <Spinner type="grow" size={props.size ? props.size : 'lg'} color={props.color} />
                {props.children ? props.children : <h4>Chargement...</h4>}
            </div>
        </>
    )
}

export default Loading