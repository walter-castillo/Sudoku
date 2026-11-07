# Sudoku

Un sudoku para jugar desde el navegador o el celular, que anda sin internet. Lo hice con React y guarda todo en el dispositivo: la partida que dejás a medias y las estadísticas.

## Qué tiene

- 4 niveles: Fácil, Medio, Difícil y Experto
- Los tableros se generan en el momento, siempre con una sola solución
- Notas a lápiz, borrar, pistas y contador de errores
- Resalta la fila, la columna, el bloque y los números repetidos
- Te muestra cuántos de cada número te faltan colocar
- Si cerrás la app, la partida queda como estaba
- Estadísticas: partidas jugadas, porcentaje de victorias, rachas, mejor tiempo y promedio por nivel
- Historial de las últimas partidas, que se puede exportar a JSON
- Se puede instalar en el celular como una app (PWA)
- Tema claro y oscuro según el sistema

## Cómo se juega

Tocás una casilla y elegís el número. En el teclado de la computadora también podés usar los números, las flechas, Backspace para borrar y la tecla `N` para activar las notas.

Las pistas suman 30 segundos al tiempo. Si empezás una partida nueva sin terminar la anterior, queda registrada como abandonada.

## Tecnologías

- React
- Vite
- IndexedDB, sin librerías
- vite-plugin-pwa
- Netlify para publicarlo

No tiene backend. Los datos no salen del dispositivo.

## Correrlo en tu máquina

```bash
git clone <url-del-repo>
cd sudoku
npm install
npm run dev
```

Para probar la versión instalable y el modo sin conexión:

```bash
npm run build
npm run preview
```

## Estructura

```
src/
  App.jsx      # toda la app: generador, tablero y estadísticas
  main.jsx
public/
  pwa-192.png
  pwa-512.png
index.html
vite.config.js
netlify.toml
```

## Cómo funciona por dentro

El generador arma una grilla completa con backtracking y después va sacando números de a uno, comprobando cada vez que el tablero siga teniendo una única solución. Los niveles se diferencian por la cantidad de casillas vacías.

La partida en curso se guarda en IndexedDB en cada movimiento. Cada partida terminada o abandonada se agrega a un historial, y de ahí salen las estadísticas.

## Para más adelante

- Login y sincronización entre dispositivos
- Desafío diario
- Deshacer y rehacer
- Pistas que expliquen la técnica
- Ranking

## Autor

Walter Castillo
