import React, { useContext } from 'react';
import UserContext from './context/UserContext';

function Home() {
  const { user } = useContext(UserContext);

  return (
    <div>
      <header className="App-header">
        <h1>IMAGINE</h1>
      </header>
      <section id="intro">
        <h2>Intro</h2>
        <p>Hello {user.name}!</p>
        <p data-testid="intro-text">The IMAGINE project is part of...</p>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean sed
          arcu auctor, scelerisque velit porta, fringilla lectus. Cras id erat
          sapien.
        </p>
        {/*
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean sed
            arcu auctor, scelerisque velit porta, fringilla lectus. Cras id erat
            sapien. Duis vehicula fringilla eleifend. Aenean scelerisque at elit
            vitae blandit. Pellentesque placerat luctus vulputate. Morbi euismod
            ex et consequat luctus. Nam eu venenatis lectus. Pellentesque dolor
            nunc, scelerisque non velit eu, ornare rutrum lorem. Pellentesque
            luctus tellus sit amet odio mollis pulvinar. Vivamus erat nunc,
            feugiat at dapibus eget, vestibulum ut nulla. Suspendisse potenti.
            Pellentesque non mi consequat, faucibus velit sit amet, luctus
            ligula. Aenean a sodales tellus. Fusce turpis nunc, porta nec
            posuere at, aliquam ac libero. Donec tincidunt aliquet tristique.
            Donec rutrum, neque feugiat ultrices porttitor, tortor dui consequat
            lacus, vel pulvinar nisi quam in mi. Mauris dictum fringilla
            volutpat. Suspendisse potenti. Proin euismod massa vel luctus
            iaculis. Nam eu viverra sapien. Donec quis ultrices ante. Donec
            gravida aliquet quam ut elementum. Sed scelerisque venenatis nibh,
            in auctor felis gravida sed. Morbi facilisis ligula sit amet odio
            consectetur pharetra. Aenean ut erat eget urna rhoncus ultricies.
            Suspendisse potenti. Phasellus euismod ut ligula eget lobortis.
            Phasellus vehicula turpis rhoncus, aliquet mi ac, semper risus.
            Phasellus et neque a felis vulputate malesuada. Donec quam libero,
            suscipit sodales orci a, porttitor dapibus risus. Integer non
            feugiat felis. Morbi quis interdum odio, non rhoncus leo. Nam
            placerat orci non placerat molestie. Cras elit est, efficitur
            fermentum aliquet sed, lobortis id tortor. Nam tristique venenatis
            felis quis maximus. In sit amet sodales risus. In nec ex consequat,
            finibus felis id, malesuada dolor. Vivamus venenatis vestibulum
            odio, vitae mattis lacus cursus non. Etiam a tincidunt sem. Maecenas
            id dapibus mi, non tristique dui. Suspendisse erat dolor, eleifend
            eu erat nec, dapibus ornare urna. Ut aliquam, purus vitae malesuada
            fermentum, ante felis tincidunt eros, sit amet vulputate nunc nulla
            vitae ante. Vestibulum et lacinia purus, et molestie est. Maecenas
            malesuada euismod tincidunt. Ut euismod mi venenatis sem sagittis
            sollicitudin. Morbi gravida justo rhoncus, dictum justo eget, varius
            nisl. Praesent id mollis nibh, sed pellentesque tortor. Quisque
            ultrices ultrices sem, vel vestibulum libero. Cras tristique
            hendrerit maximus. Phasellus tortor mauris, convallis quis mattis
            nec, dignissim et arcu. In vehicula risus nec mattis sodales. Duis
            tellus sapien, blandit ut nisl nec, laoreet dictum nisl. Nam congue
            eu justo ac vulputate. Vivamus tincidunt leo vitae nulla pharetra
            pulvinar. Donec sit amet porttitor metus. Maecenas tempor nibh eu
            nibh vulputate, nec aliquam libero fermentum. Vivamus aliquet ornare
            purus, convallis dapibus tortor eleifend vitae. Proin et dictum
            felis. Etiam laoreet mollis nibh in varius. Morbi sit amet augue sed
            ante imperdiet feugiat ut ut ante. Nullam viverra neque quis mi
            varius malesuada. Lorem ipsum dolor sit amet, consectetur adipiscing
            elit. Aenean sed arcu auctor, scelerisque velit porta, fringilla
            lectus. Cras id erat sapien. Duis vehicula fringilla eleifend.
            Aenean scelerisque at elit vitae blandit. Pellentesque placerat
            luctus vulputate. Morbi euismod ex et consequat luctus. Nam eu
            venenatis lectus. Pellentesque dolor nunc, scelerisque non velit eu,
            ornare rutrum lorem. Pellentesque luctus tellus sit amet odio mollis
            pulvinar. Vivamus erat nunc, feugiat at dapibus eget, vestibulum ut
            nulla. Suspendisse potenti. Pellentesque non mi consequat, faucibus
            velit sit amet, luctus ligula. Aenean a sodales tellus. Fusce turpis
            nunc, porta nec posuere at, aliquam ac libero. Donec tincidunt
            aliquet tristique. Donec rutrum, neque feugiat ultrices porttitor,
            tortor dui consequat lacus, vel pulvinar nisi quam in mi. Mauris
            dictum fringilla volutpat. Suspendisse potenti. Proin euismod massa
            vel luctus iaculis. Nam eu viverra sapien. Donec quis ultrices ante.
            Donec gravida aliquet quam ut elementum. Sed scelerisque venenatis
            nibh, in auctor felis gravida sed. Morbi facilisis ligula sit amet
            odio consectetur pharetra. Aenean ut erat eget urna rhoncus
            ultricies. Suspendisse potenti. Phasellus euismod ut ligula eget
            lobortis. Phasellus vehicula turpis rhoncus, aliquet mi ac, semper
            risus. Phasellus et neque a felis vulputate malesuada. Donec quam
            libero, suscipit sodales orci a, porttitor dapibus risus. Integer
            non feugiat felis. Morbi quis interdum odio, non rhoncus leo. Nam
            placerat orci non placerat molestie. Cras elit est, efficitur
            fermentum aliquet sed, lobortis id tortor. Nam tristique venenatis
            felis quis maximus. In sit amet sodales risus. In nec ex consequat,
            finibus felis id, malesuada dolor. Vivamus venenatis vestibulum
            odio, vitae mattis lacus cursus non. Etiam a tincidunt sem. Maecenas
            id dapibus mi, non tristique dui. Suspendisse erat dolor, eleifend
            eu erat nec, dapibus ornare urna. Ut aliquam, purus vitae malesuada
            fermentum, ante felis tincidunt eros, sit amet vulputate nunc nulla
            vitae ante. Vestibulum et lacinia purus, et molestie est. Maecenas
            malesuada euismod tincidunt. Ut euismod mi venenatis sem sagittis
            sollicitudin. Morbi gravida justo rhoncus, dictum justo eget, varius
            nisl. Praesent id mollis nibh, sed pellentesque tortor. Quisque
            ultrices ultrices sem, vel vestibulum libero. Cras tristique
            hendrerit maximus. Phasellus tortor mauris, convallis quis mattis
            nec, dignissim et arcu. In vehicula risus nec mattis sodales. Duis
            tellus sapien, blandit ut nisl nec, laoreet dictum nisl. Nam congue
            eu justo ac vulputate. Vivamus tincidunt leo vitae nulla pharetra
            pulvinar. Donec sit amet porttitor metus. Maecenas tempor nibh eu
            nibh vulputate, nec aliquam libero fermentum. Vivamus aliquet ornare
            purus, convallis dapibus tortor eleifend vitae. Proin et dictum
            felis. Etiam laoreet mollis nibh in varius. Morbi sit amet augue sed
            ante imperdiet feugiat ut ut ante. Nullam viverra neque quis mi
            varius malesuada.
          </p>
        */}
      </section>
    </div>
  );
}

export default Home;
