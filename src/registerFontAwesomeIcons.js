import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faBookMedical,
  faDownload,
  faCog,
  faMicroscope,
  faRedo,
  faSearch,
  faSync,
  faLock,
  faTasks,
  faSlidersH,
  faExternalLinkAlt
} from '@fortawesome/free-solid-svg-icons';

export default function registerIcons() {
  // Add icons to the library
  library.add(faMicroscope);
  library.add(faBookMedical);
  library.add(faDownload);
  library.add(faSearch);
  library.add(faCog);
  library.add(faSync);
  library.add(faRedo);
  library.add(faLock);
  library.add(faTasks);
  library.add(faSlidersH);
  library.add(faExternalLinkAlt);
}
