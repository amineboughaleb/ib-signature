'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

/**
 * La carte d'un logement.
 *
 * Servie depuis notre propre serveur : aucun script tiers, aucune clé d'API,
 * aucun traceur. Seules les tuiles viennent d'OpenStreetMap.
 *
 * Un cercle, pas une épingle. Le voyageur a besoin de savoir dans quel quartier
 * il dormira, à quelle distance de la mer ou du bureau où il se rend - il n'a
 * pas besoin de la porte, et le propriétaire n'a pas envie qu'elle soit
 * publique. Le zoom est donc plafonné : on peut se rapprocher jusqu'à lire les
 * rues, jamais jusqu'à désigner un immeuble.
 *
 * La molette ne prend la main qu'après un clic dans la carte. Sans cela, un
 * visiteur qui fait défiler la page se retrouve à zoomer sans l'avoir voulu, et
 * la page se bloque sous ses doigts.
 */

const METRES_PAR_PIXEL_Z0 = 156543.03392;

export default function CarteVue({
  lat,
  lng,
  rayonM,
  rayonPlancherM,
  libelle,
  aide,
}: {
  lat: number;
  lng: number;
  rayonM: number;
  rayonPlancherM: number;
  libelle: string;
  aide: string;
}) {
  const boite = useRef<HTMLDivElement | null>(null);
  const [echec, setEchec] = useState(false);

  useEffect(() => {
    let carte: any;
    let annule = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (annule || !boite.current) return;

      const h = boite.current.clientHeight || 380;
      const cos = Math.cos((lat * Math.PI) / 180);

      /* Zoom continu : les paliers entiers de Leaflet rateraient le plancher
         d'un facteur deux. `zoomSnap: 0` laisse le plafond tomber au mètre
         près. */
      const zoomPour = (rayonVisibleM: number) =>
        Math.log2((METRES_PAR_PIXEL_Z0 * cos * h) / (2 * rayonVisibleM));

      /* Au-delà de ce plafond, la demi-hauteur visible passerait sous le rayon
         plancher : c'est ce qui empêche de descendre jusqu'à la porte. */
      const zoomMax = Math.max(1, zoomPour(rayonPlancherM));
      const zoomDepart = Math.min(zoomMax, Math.max(1, zoomPour(rayonM * 1.3)));

      carte = L.map(boite.current, {
        center: [lat, lng],
        zoom: zoomDepart,
        minZoom: Math.max(1, zoomDepart - 4),
        maxZoom: zoomMax,
        zoomSnap: 0,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 120,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      });

      /* Ce que le visiteur voit vraiment, exposé pour le contrôle : sans cela,
         la promesse « on ne descend jamais sous cent mètres » ne serait
         vérifiable qu'à l'oeil. */
      const publier = () => {
        if (!boite.current) return;
        const res = (METRES_PAR_PIXEL_Z0 * cos) / Math.pow(2, carte.getZoom());
        boite.current.dataset.zoom = carte.getZoom().toFixed(2);
        boite.current.dataset.zoommax = zoomMax.toFixed(2);
        boite.current.dataset.rayonVisible = String(Math.round((res * h) / 2));
      };
      carte.on('zoomend', publier);
      publier();

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxNativeZoom: 19,
        maxZoom: Math.ceil(zoomMax),
        attribution: '&copy; OpenStreetMap',
      })
        .on('tileerror', () => setEchec(true))
        .addTo(carte);

      /* Le cercle est tracé en mètres : il garde sa taille réelle à tous les
         niveaux de zoom, et ne ment donc jamais sur ce qu'il couvre. */
      L.circle([lat, lng], {
        radius: rayonM,
        color: '#15120e',
        weight: 1.5,
        fillColor: '#15120e',
        fillOpacity: 0.1,
        interactive: false,
      }).addTo(carte);

      carte.on('click', () => carte.scrollWheelZoom.enable());
      carte.on('mouseout', () => carte.scrollWheelZoom.disable());
    })();

    return () => {
      annule = true;
      if (carte) carte.remove();
    };
  }, [lat, lng, rayonM, rayonPlancherM, libelle]);

  return (
    <>
      <div ref={boite} className="carte-toile" role="application" aria-label={libelle} />
      {echec && <span className="carte-repli">{libelle}</span>}
      <span className="carte-aide">{aide}</span>
    </>
  );
}
