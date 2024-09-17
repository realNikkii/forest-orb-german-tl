let locationsData = [];
let locationVersionNames = [];

let visitedLocationIds = [];
let locationsSortOrder = 'recent';
let locationsScrollTop = 0;
let locationsScrollWatch = null;

function initLocationControls() {
  document.getElementById('locationsButton').onclick = () => {
    initLocationsModal(true);
    openModal('locationsModal');
  };
  document.getElementById('locationsSortOrder').onchange = function() {
    locationsSortOrder = this.value;
    initLocationsModal(true);
  };
}

function updateGameLocations() {
  apiFetch('gamelocations').then(response => {
    if (!response.ok)
      throw new Error(response.statusText);
    return response.json();
  }).then(locations => {
    locationsData = locations;
    let versionNames = [];
    locationVersionNames = locations.filter(l => {
      if (versionNames.includes(l.versionAdded))
        return false;
      versionNames.push(l.versionAdded);
      return true;
    }).map(l => l.versionAdded).sort(compareVersionNames).reverse();
    document.getElementById('locationsButton').classList.remove('hidden');
  });
}

function compareVersionNames(v1, v2) {
  const v1C = v1.split('.');
  const v2C = v2.split('.');

  if (v1C.length !== v2C.length) {
    if (v2C.length > v1C.length) {
      for (let i = v1C.length; i < v2C.length; i++)
        v1C.push('0');
    } else {
      for (let i = v2C.length; i < v1C.length; i++)
        v2C.push('0');
    }
  }

  for (let v = 0; v < v1C.length; v++) {
    const v1i = parseInt(v1C[v]);
    const v2i = parseInt(v2C[v]);
    if (v1i < v2i)
      return -1;
    else if (v1i > v2i)
      return 1;
  }

  return 0;
}

function getVersionSortFunction(getVersion, versionNames) {
  return function (o1, o2) {
    const v1 = getVersion(o1);
    const v2 = getVersion(o2);

    let v1Index = v1 ? versionNames.indexOf(v1) : 999;
    let v2Index = v2 ? versionNames.indexOf(v2) : 999;

    if (v1Index === v2Index)
      return 0;

    return v2Index > -1 ? v1Index > -1 ? v1Index < v2Index ? -1 : 1 : -1 : 1;
  };
}

function initLocationsModal() {
  const locationsModal = document.getElementById('locationsModal');
  const locationItemsList = locationsModal.querySelector('.itemContainer');
  locationItemsList.innerHTML = '';

  addFilterInputs('locations', initLocationsModal, { id: 'locationsNameInput', label: 'Location' }, { id: 'locationsAuthorInput', label: 'Author' });
  locationItemsList.classList.remove('end');

  const addLocations = locations => {
    if (!locations?.length)
      return;

    for (let location of locations) {
      const locationItem = document.createElement('div');
      locationItem.classList.add('locationItem', 'imageItem', 'item', 'hideContents');

      const locationThumbnailContainer = document.createElement('div');
      locationThumbnailContainer.classList.add('locationThumbnailContainer', 'imageThumbnailContainer');

      const locationThumbnail = document.createElement('img');
      locationThumbnail.classList.add('locationThumbnail', 'imageThumbnail', 'unselectable');
      locationThumbnail.src = visitedLocationIds.includes(location.id)
        ? `${location.locationImage.replace('images/', 'images/thumb/')}/240px-${location.locationImage.slice(location.locationImage.lastIndexOf('/') + 1)}`
        : './images/unknown_location.png';

      const locationName = document.createElement('div');
      locationName.classList.add('locationName', 'imageItemLocation', 'infoText');
      locationName.innerHTML = gameId === '2kki'
        ? get2kkiLocationHtml(location)
        : gameLocationsMap[gameId].hasOwnProperty(location.title)
          ? getLocalizedLocation(gameId, gameLocalizedLocationsMap[gameId][location.title], gameLocationsMap[gameId][location.title], true)
          : location.title;

      locationThumbnail.onclick = () => locationName.querySelector('a').click();

      const author = location.primaryAuthor ? document.createElement('div') : null;
      if (author)
        author.innerHTML = getMassagedLabel(localizedMessages.locations.author.replace('{AUTHOR}', `<label class="unselectable">${location.primaryAuthor}</label>`));

      const versionAdded = location.versionAdded ? document.createElement('div') : null;
      if (versionAdded)
        versionAdded.innerHTML = getMassagedLabel(localizedMessages.locations.versionAdded.replace('{VERSION}', `<label class="unselectable">${getLocalizedVersion(location.versionAdded.replace('patch', 'Patch'))}</label>`));

      const versionUpdated = location.versionsUpdated?.length ? document.createElement('div') : null;
      if (versionUpdated) {
        let lastUpdatedVersion = location.versionsUpdated[location.versionsUpdated.length - 1];
        if (lastUpdatedVersion.includes('-'))
          lastUpdatedVersion = lastUpdatedVersion.slice(0, lastUpdatedVersion.indexOf('-'));
        versionUpdated.innerHTML = getMassagedLabel(localizedMessages.locations.versionUpdated.replace('{VERSION}', `<label class="unselectable">${getLocalizedVersion(lastUpdatedVersion.replace('patch', 'Patch'))}</label>`));
      }

      locationThumbnailContainer.append(locationThumbnail);

      const locationControls = gameId === '2kki' ? getLocationControls(location) : null;

      locationItem.append(locationThumbnailContainer);
      if (locationControls)
        locationItem.append(locationControls);
      locationItem.append(locationName);
      if (author)
        locationItem.append(author);
      if (versionAdded)
        locationItem.append(versionAdded);
      if (versionUpdated)
        locationItem.append(versionUpdated);

      // Filter Locations - filter by text
      let textFilter = document.getElementById('locationsFilterInput').value.toLowerCase();

      if (textFilter === '')
        locationItemsList.append(locationItem);
      else {
        textFilter = textFilter.toLowerCase();
         // Filter Screenshots -  Check if location and filter matches
        if (document.getElementById('locationsNameInput').checked && locationName.innerText.toLowerCase().includes(textFilter))
          locationItemsList.append(locationItem);
        // Filter Screenshots -  Check if author and filter matches
        else if (document.getElementById('locationsAuthorInput').checked && author.innerText.toLowerCase().includes(textFilter))
          locationItemsList.append(locationItem);
      }

      updateThemedContainer(locationItem);
    }
  };

  const getLocationsChunk = (offset, limit) => {
    const sortedLocations = locationsData
      .filter(l => !l.secret || visitedLocationIds.includes(l.id))
      .sort(locationsSortOrder === 'recent' ? getVersionSortFunction(l => l.versionAdded, locationVersionNames) : () => 0);
    return sortedLocations.slice(offset, offset + limit);
  };

  let offset = 0;

  if (locationsScrollWatch)
    locationsScrollWatch.destroy();
  locationsScrollWatch = new ScrollWatch({
    container: '#locationsModal .modalContent',
    watch: '.locationItem',
    watchOnce: false,
    infiniteScroll: true,
    infiniteOffset: 32,
    watchOffsetYTop: 250,
    watchOffsetYBottom: 250,
    onElementInView: e => e.el.classList.remove('hideContents'),
    onElementOutOfView: e => {
      e.el.classList.add('hideContents');
      e.el.style.containIntrinsicHeight = `${e.el.offsetHeight}px`;
    },
    onInfiniteYInView: () => {
      window.setTimeout(() => {
        let contentWidth = window.innerWidth - 112 - 18;
        let itemsPerRow = Math.floor(contentWidth / 220);
        let chunkSize = itemsPerRow * Math.ceil(locationItemsList.offsetHeight / 224);

        const locations = getLocationsChunk(offset, chunkSize);
        offset += chunkSize;

        removeLoader(locationsModal);
        if (locations?.length) {
          addLocations(locations);
          locationsScrollWatch.refresh();
        } else {
          locationsScrollWatch.pauseInfiniteScroll();
          locationItemsList.classList.add('end');
        }
      }, 10);
    }
  });

  addLoader(locationsModal);
}

function getLocationControls(location) {
  const locationControls = document.createElement('div');
  locationControls.classList.add('locationControls', 'imageControls');
  locationControls.dataset.locationId = location.id;

  if (gameId === '2kki') {
    const tracked = config.trackedLocationId === location.id;

    const trackButton = getSvgIcon('track');
    trackButton.classList.add('iconButton', 'toggleButton', 'fadeToggleButton', 'altToggleButton', 'trackToggle');
    if (tracked)
      trackButton.classList.add('toggled');
    trackButton.onclick = function () {
      const toggled = !this.classList.contains('toggled');
      if (toggled) {
        const existingToggle = document.querySelector('.trackToggle.toggled');
        if (existingToggle)
          existingToggle.click();
      }
      this.classList.toggle('toggled', toggled);
      config.trackedLocationId = this.classList.contains('toggled') ? location.id : null;
      document.getElementById('nextLocationContainer').classList.toggle('hidden', !toggled);
      addTooltip(this, getMassagedLabel(localizedMessages.locations.track.tooltip[toggled ? 'off' : 'on'], true), true);
      if (toggled)
        sendSessionCommand('nl', [ location.id ]);
      updateConfig(config);
    };
    addTooltip(trackButton, getMassagedLabel(localizedMessages.locations.track.tooltip[tracked ? 'off' : 'on'], true), true);

    locationControls.append(trackButton);
  }

  return locationControls;
}

(function () {
  addSessionCommandHandler('l', locationIds => {
    locationIds.map(id => parseInt(id)).map(id => {
      if (!visitedLocationIds.includes(id))
        visitedLocationIds.push(id);
    });
  });
  if (gameId === '2kki')
    addSessionCommandHandler('nl', args => {
      const locationNames = [];
      const locations = JSON.parse(args).filter(l => {
        if (locationNames.includes(l.title))
          return false;
        locationNames.push(l.title);
        return true;
      });
      updateNextLocations(locations);
    })
  
  updateGameLocations();
})();