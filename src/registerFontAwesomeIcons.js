import { library } from '@fortawesome/fontawesome-svg-core';
import { faMicroscope, faSync } from '@fortawesome/free-solid-svg-icons';

export default function registerIcons() {
  // Add icons to the library
  library.add(faMicroscope);
  library.add(faSync);
}
