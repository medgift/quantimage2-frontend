import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
  createRef,
} from 'react';
import VegaChart from './VegaChart';
import Loading from './Loading';
import DisplayedAnnotation from './DisplayedAnnotation';
import useDynamicRefs from 'use-dynamic-refs';
import './Main.scss';

const Main = (props, ref) => {
  const [getRef, setRef] = useDynamicRefs();

  const [displayAnnotation, setDisplayedAnnotation] = useState(null);
  const [images, setImages] = useState(null);

  /*useEffect(() => {
    const temp = [];
    props.images.map((img, index) => {
      convertURIToImageData(props.images[index].img).then((image) => {
        image.id = img.id;
        image.raw = img.img;
        temp.push(image);
      });
    });
    setImages(temp);
  }, [props.images]);*/

  /*useImperativeHandle(ref, () => ({
    getChart(type) {
      return getRef(type + '-chart').current.getChart(type);
    },
    displayAnnotation(annotation) {
      setDisplayedAnnotation(annotation);
    },
    closeAnnotation() {
      closeAnnotation();
    },
  }));*/

  const closeAnnotation = () => {
    setDisplayedAnnotation(null);
  };

  const deleteAnnotation = () => {
    setDisplayedAnnotation(null);
    props.askDelete(displayAnnotation);
  };

  const editAnnotation = () => {
    setDisplayedAnnotation(null);
    props.askEdit(displayAnnotation);
  };

  const answerAnnotation = () => {
    setDisplayedAnnotation(null);
    props.askAnswer(displayAnnotation);
  };

  const convertURIToImageData = (URI) => {
    return new Promise((resolve, reject) => {
      if (URI == null) return reject();
      const canvas = document.createElement('canvas'),
        context = canvas.getContext('2d'),
        image = new Image();
      image.addEventListener(
        'load',
        () => {
          canvas.width = image.width;
          canvas.height = image.height;
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(context.getImageData(0, 0, canvas.width, canvas.height));
        },
        false
      );
      image.src = URI;
    });
  };

  return (
    <>
      <div className="Main">
        {displayAnnotation ? (
          <>
            <DisplayedAnnotation
              annotation={displayAnnotation}
              close={closeAnnotation}
              delete={deleteAnnotation}
              edit={editAnnotation}
              answer={answerAnnotation}
              images={images}
            />
          </>
        ) : props.loading ? (
          <Loading color="dark">
            <h3>Loading Charts...</h3>
          </Loading>
        ) : (
          <div className="charts">
            {props.charts.map((c) => {
              return (
                <div id={c.id} key={c.id}>
                  <VegaChart
                    ref={setRef(c.id + '-chart')}
                    title={c.title}
                    chart={c.chart}
                    type={c.type}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default forwardRef(Main);
