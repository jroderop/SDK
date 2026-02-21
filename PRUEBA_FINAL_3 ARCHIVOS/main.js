// Lógica principal del WebMap JRP
 // Carga de los MÓDULOS necesarios para el webmap
require([
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/layers/GraphicsLayer",
  "esri/renderers/UniqueValueRenderer",
  "esri/renderers/SimpleRenderer",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/symbols/SimpleFillSymbol",
  "esri/symbols/PictureMarkerSymbol",
  "esri/widgets/LayerList",
  "esri/widgets/Sketch",
  "esri/widgets/BasemapToggle",
  "esri/widgets/Search",
  "esri/Graphic",
  "esri/geometry/geometryEngine"
], (
  Map, MapView, FeatureLayer, GraphicsLayer,
  UniqueValueRenderer, SimpleRenderer, SimpleMarkerSymbol, SimpleFillSymbol, PictureMarkerSymbol,
  LayerList, Sketch, BasemapToggle, Search, Graphic, geometryEngine
) => {

   // Creación del Mapa
    const map = new Map({
    basemap: "dark-gray-vector"
  });

  // Creación de la vista del mapa y configuración inicial de la vista
  const view = new MapView({
    container: "viewDiv",
    map: map,
    center: [-3.7492, 40.4637], // Centro de España
    zoom: 6,
    background: {
      color: "#0d131f" // Respaldo al CSS
    }
  });

  // Configuración de los renderers para las capas de Red Natura y Playas
  // Renderer para Red Natura 2000 para el campo "TIPO_NUEVO"
  const redNaturaRenderer = new UniqueValueRenderer({
    field: "TIPO_NUEVO",
    defaultSymbol: { type: "simple-fill", color: [150, 150, 150, 0.5] }, // Fallback
    uniqueValueInfos: [
      {
        value: "LIC", // 4a
        symbol: { type: "simple-fill", color: "#cbf3f0", outline: { width: 0 } }
      },
      {
        value: "ZEPA", // 4b
        symbol: { type: "simple-fill", color: "#ffbf69", outline: { width: 0 } }
      },
      {
        value: "LIC/ZEPA", // 4c
        symbol: { type: "simple-fill", color: "#c7b6ec", outline: { width: 0 } }
      }
    ]
  });

  // Renderer simple para las playas, con un símbolo de punto azul claro
  const playasRenderer = new SimpleRenderer({
    symbol: new SimpleMarkerSymbol({
      color: "#4facfe", // Azul claro brillante
      size: "6px",
      outline: { color: [255, 255, 255, 0.5], width: 0.5 }
    })
  });

   // Configuración y carga de las capas de datos (Red Natura 2000 y Playas)
  const popupRedNatura = {
    title: "Red Natura 2000: {TIPO_NUEVO}",
    content: "Nombre del espacio: <b>{SOName}</b>"
  };

  // Capa Red Natura 2000 con opacidad 80%
  const redNaturaLayer = new FeatureLayer({
    url: "https://services1.arcgis.com/nCKYwcSONQTkPA4K/ArcGIS/rest/services/Red_Natura_2000/FeatureServer/0",
    renderer: redNaturaRenderer,
    opacity: 0.3,
    popupTemplate: popupRedNatura,
    outFields: ["TIPO_NUEVO", "SOName"]
  });

  // Definición del popup para las playas, mostrando información personalizada de cada playa.
  const popupPlayas = {
    title: "Playa: {Nombre}",
    content: [
      {
        type: "fields",
        fieldInfos: [
          { fieldName: "Comunidad_", label: "Comunidad Autónoma" },
          { fieldName: "Provincia", label: "Provincia" },
          { fieldName: "Término_M", label: "Término Municipal" },
          { fieldName: "Descripci", label: "Descripción" },
          { fieldName: "Submarinismo", label: "Submarinismo" }
        ]
      }
    ]
  };

  // Capa de playas con su renderer, popup y campos necesarios para búsquedas y consultas.
  const playasLayer = new FeatureLayer({
    url: "https://services1.arcgis.com/nCKYwcSONQTkPA4K/ArcGIS/rest/services/Playas_2015/FeatureServer/0",
    renderer: playasRenderer,
    popupTemplate: popupPlayas,
    outFields: ["*"], // Necesario para la búsqueda y consultas
    effect: "bloom(2, 0.5px, 0.0)" // 15f. Aplicación de Efectos
  });

  // Configuración de las CAPAS DE GRAFICOS que se verán en la LayerList.
  // Capas de gráficos para resultados de la consulta y contenedor de icono
  const resultGraphicsLayer = new GraphicsLayer({
    title: "Playas Submarinismo",
    effect: "drop-shadow(0px 0px 2px #ffffff)" // Un pequeño brillo extra
  });

  // Capa de gráficos para el dibujo del usuario.
  const sketchGraphicsLayer = new GraphicsLayer({ title: "Zona de Dibujo" });

  // Capa de gráficos para mostrar la intersección entre el dibujo del sketch y la Red Natura 2000.  
  const intersectionGraphicsLayer = new GraphicsLayer({
    title: "Red Natura Intersectada",
    effect: "bloom(0.7, 0.2px, 0)" // Efecto bloom para la selección también
  });

  // Orden de capas: primero polígonos, luego puntos y resultados
  map.addMany([redNaturaLayer, intersectionGraphicsLayer, sketchGraphicsLayer, playasLayer, resultGraphicsLayer]);

  // DEFINICIÓN DE LOS WIDGETS
  // Widget LayerList
  const layerList = new LayerList({
    view: view
  });
  view.ui.add(layerList, "bottom-left");

  // Widget Sketch.
  const sketch = new Sketch({
    layer: sketchGraphicsLayer,
    view: view,
    creationMode: "single", // Solo permitir un dibujo a la vez si se desea
    availableCreateTools: ["polygon", "rectangle", "circle"] // Limitamos a geometrías de área
  });
  view.ui.add(sketch, "top-right");

  // Widget BasemapToggle para cambiar entre el mapa base oscuro y el satélite.
  const basemapToggle = new BasemapToggle({
    view: view,
    nextBasemap: "satellite"
  });
  view.ui.add(basemapToggle, "bottom-right");

  // Widget Search configurado para buscar tanto en la capa de playas como en la de Red Natura 2000.
  const searchWidget = new Search({
    view: view,
    includeDefaultSources: false, // Personalizado: quitamos el geocodificador mundial si queremos forzar búsqueda en capas
    sources: [
      {
        layer: playasLayer,
        searchFields: ["Nombre"],
        displayField: "Nombre",
        exactMatch: false,
        outFields: ["*"], //para mostrar toda la información en el popup
        name: "Playas",
        placeholder: "Busca una playa..."
      },
      {
        layer: redNaturaLayer,
        searchFields: ["SOName"],
        displayField: "SOName",
        exactMatch: false,
        outFields: ["*"], //para mostrar toda la información en el popup
        name: "Red Natura",
        placeholder: "Busca espacio protegido..."
      }
    ]
  });
  view.ui.add(searchWidget, "bottom-right");// Ubicación en la esquina inferior derecha, junto al BasemapToggle

  // CONSULTA
  // Para comprobar en la consola que se ha cargado el mapa y las capas correctamente antes de iniciar la consulta. 
  // Esperamos a que la vista esté lista
  view.when(() => {
    
    console.log("Iniciando consulta al servidor para playas de submarinismo...");

    // Botón para mostrar las playas aptas para submarinismo.
    let submarinismoActivo = false;
    const btnSubmarinis = document.getElementById("btnSubmarinis");

    btnSubmarinis.addEventListener("click", () => {
      submarinismoActivo = !submarinismoActivo;
      if (submarinismoActivo) {
        btnSubmarinis.innerText = "Desactivar Playas";

        // Playas con SUBMARINIS = 'Sí'
        const query = playasLayer.createQuery();
        query.where = "SUBMARINIS = 'Sí'";
        query.outFields = ["NOMBRE"];
        query.returnGeometry = true;

        
        playasLayer.queryFeatures(query).then((results) => {
          const features = results.features;

          // Definición de un símbolo personalizado para las playas aptas para submarinismo (referenciado de Flaticon).
          const subSymbol = new PictureMarkerSymbol({
            url: "https://cdn-icons-png.flaticon.com/512/8205/8205034.png",
            width: "30px",
            height: "30px"
          });

          // Para asignar el símbolo personalizado y añadir la playa de la consulta a la capa de graficos de resultados.
          features.forEach((feature) => {
            feature.symbol = subSymbol;
            feature.popupTemplate = {
              title: "Playa: {NOMBRE}",
              content: "Esta playa es apta para el submarinismo."
            };
            resultGraphicsLayer.add(feature);
          });

          // Para hacer zoom a la extensión de las playas encontradas.
          view.goTo(features);
        }).catch((error) => {
          console.error("Error en la consulta de submarinismo: ", error);
        });
      } else {
        btnSubmarinis.innerText = "Playas aptas para Submarinismo";
        resultGraphicsLayer.removeAll();
      }
    });
  });

  // Intersección Red Natura con geometría del Sketch
  sketch.on("create", (event) => {
    // Solo ejecutamos cuando el dibujo se ha completado
    if (event.state === "complete") {
      const geometry = event.graphic.geometry;
      console.log("Dibujo completado. Calculando intersección con Red Natura...");

      // Limpiar resultados anteriores de intersección
      intersectionGraphicsLayer.removeAll();

      // Consulta para obtener los espacios protegidos que intersectan con la geometría dibujada.
      const query = redNaturaLayer.createQuery();
      query.geometry = geometry;
      query.spatialRelationship = "intersects";
      query.outFields = ["TIPO_NUEVO", "SOName"];

      // simbología para resaltar las áreas de Red Natura que intersectan con el dibujo del usuario.
      redNaturaLayer.queryFeatures(query).then((results) => {
        console.log(`Intersectados ${results.features.length} espacios protegidos.`);

        
        const highlightSymbol = new SimpleFillSymbol({
          color: [157, 247, 193, 0.2], 
          outline: {
            color: "#9df7c1",
            width: 3
          }
        });

        
        const intersectionGraphics = results.features.map((feature) => {
          return new Graphic({
            geometry: feature.geometry,
            symbol: highlightSymbol,
            attributes: feature.attributes,
            popupTemplate: popupRedNatura
          });
        });

        // Añadimos al mapa
        intersectionGraphicsLayer.addMany(intersectionGraphics);
        // Para mostrar posibles errores en el proceso de intersección.
      }).catch((error) => {
        console.error("Error calculando intersección: ", error);
      });
    }
  });
});