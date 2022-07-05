import {createRoot} from 'react-dom/client';
import {useRef, useState, useCallback, useMemo, useEffect} from 'react';
import {css, cx} from '@emotion/css';
import '@fontsource/inter';
import './styles/index.scss';
import * as d3 from 'd3';
import {MathUtils} from 'three';
import {samples} from 'culori';
import Plotly from 'plotly.js-dist-min';
import {default as chance} from 'chance';

import {Slider} from '@mui/material';

const GOLDEN_RATIO = 1.618;
class ValueNoise {
  static NUM_VALUES = 256; // plot count
  static SPACING = 56; // smoothness The larger the value, the flatter it becomes. The smaller the value, the more undulations.
  constructor(spacing) {
    this.randomer = () => {
      return chance().floating({min: 0, max: 1});
    };
    this.values = samples(ValueNoise.NUM_VALUES).map((t) => {
      return this.randomer();
    });
    this.spacing = spacing || ValueNoise.SPACING;
  }
  evaluate(x) {
    const x1 = Math.floor(x / this.spacing);
    const x2 = Math.ceil(x / this.spacing);
    const n1 = this.values[x1 % ValueNoise.NUM_VALUES];
    const n2 = this.values[x2 % ValueNoise.NUM_VALUES];
    const k = 0.5 - 0.5 * Math.cos(((x / this.spacing) % 1) * Math.PI);
    return MathUtils.lerp(n1, n2, k);
  }
}

const getDomain = (data, key) => {
  const {min, max} = data.reduce(
    (acc, row) => {
      return {
        min: Math.min(acc.min, row[key]),
        max: Math.max(acc.max, row[key]),
      };
    },
    {min: Infinity, max: -Infinity}
  );
  return {min, max};
};

let t = 0;

const App = () => {
  const speed = 50; // 0 <<< speed <<< 100
  const requestRef = useRef();
  const graphDomRef = useRef(null);

  const [spacing, setSpacing] = useState(null);

  const v = useMemo(() => {
    return new ValueNoise(spacing);
  }, [spacing]);

  const size = () => {
    let resizedWidth = window.innerWidth;
    if (window.matchMedia(`(min-width: 1500px)`).matches) {
      resizedWidth = 1200;
    } else if (window.matchMedia(`(min-width: 1300px)`).matches) {
      resizedWidth = 1000;
    } else if (window.matchMedia(`(min-width: 1200px)`).matches) {
      resizedWidth = 950;
    } else if (window.matchMedia(`(min-width: 1100px)`).matches) {
      resizedWidth = 900;
    } else if (window.matchMedia(`(min-width: 900px)`).matches) {
      resizedWidth = 800;
    } else if (window.matchMedia(`(min-width: 800px)`).matches) {
      resizedWidth = 700;
    } else if (window.matchMedia(`(min-width: 700px)`).matches) {
      resizedWidth = 620;
    } else if (window.matchMedia(`(min-width: 600px)`).matches) {
      resizedWidth = 520;
    } else if (window.matchMedia(`(min-width: 500px)`).matches) {
      resizedWidth = 420;
    } else if (window.matchMedia(`(min-width: 400px)`).matches) {
      resizedWidth = 370;
      return {width: resizedWidth, height: window.innerHeight * 0.5};
    } else {
      resizedWidth = 350;
      return {width: resizedWidth, height: window.innerHeight * 0.5};
    }
    let resizedHeight = resizedWidth / GOLDEN_RATIO;
    return {width: resizedWidth, height: resizedHeight};
  };

  const pointInfoList = useMemo(() => {
    const resultList = [];
    const list = samples(ValueNoise.NUM_VALUES);
    for (let index = 0; index < list.length; index++) {
      const item = list[index] * ValueNoise.NUM_VALUES;
      resultList.push({x: item, y: v.evaluate(item)});
    }
    return resultList;
  }, [v]);

  useEffect(() => {
    const {min: minX, max: maxX} = getDomain(pointInfoList, `x`);
    const {min: minY, max: maxY} = getDomain(pointInfoList, `y`);
    const graphDom = graphDomRef.current;
    Plotly.newPlot(
      graphDom,
      [
        {
          x: pointInfoList.map((pointInfo) => {
            return pointInfo.x;
          }),
          y: pointInfoList.map((pointInfo) => {
            return pointInfo.y;
          }),
          mode: 'lines',
          fill: 'tozeroy',
          fillcolor: '#DFF6FF',
        },
      ],
      {
        xaxis: {range: [minX, maxX]},
        yaxis: {range: [0, 1]},
        ...size(),
      }
    );
  }, [pointInfoList]);

  const compute = useCallback((f) => {
    const resultList = [];
    return (t) => {
      samples(ValueNoise.NUM_VALUES).forEach((x) => {
        const item = x * ValueNoise.NUM_VALUES;
        resultList.push({
          x: item + t,
          y: f(item + t),
        });
      });
      return resultList;
    };
  }, []);

  const doCompute = useCallback(() => {
    return compute((x) => {
      return v.evaluate(x);
    })(t * speed);
  }, [v]);

  const loop = useCallback(
    (time) => {
      t = t + 0.01;
      const graphDom = graphDomRef.current;
      const computedPointInfoList = doCompute();
      const {min: minX, max: maxX} = getDomain(computedPointInfoList, `x`);
      const {min: minY, max: maxY} = getDomain(computedPointInfoList, `y`);
      Plotly.react(
        graphDom,
        [
          {
            x: computedPointInfoList.map((pointInfo) => {
              return pointInfo.x;
            }),
            y: computedPointInfoList.map((pointInfo) => {
              return pointInfo.y;
            }),
            mode: 'lines',
            fill: 'tozeroy',
            fillcolor: '#DFF6FF',
          },
        ],
        {
          xaxis: {range: [maxX - ValueNoise.NUM_VALUES, maxX]},
          yaxis: {range: [0, 1]},
          ...size(),
        }
      );
      requestRef.current = window.requestAnimationFrame(loop);
    },
    [doCompute]
  );

  useEffect(() => {
    if (requestRef.current) {
      window.cancelAnimationFrame(requestRef.current);
    }
    requestRef.current = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(requestRef.current);
    };
  }, [v]);

  useEffect(() => {
    requestRef.current = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // https://community.plotly.com/t/resize-of-plotly-chart/333
  //instruction resizes plot
  const handleResize = (e) => {
    const graphDom = graphDomRef.current;
    Plotly.relayout(graphDom, size());
  };

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  const handleChange = (e) => {
    setSpacing(e.target.value);
  };
  return (
    <>
      <div
        className={css`
          margin: 0 auto;
          max-width: 30rem;
          width: 100%;
          padding: 3rem;
        `}
      >
        <Slider
          defaultValue={0}
          min={10}
          max={100}
          step={1}
          value={spacing}
          aria-label="Default"
          valueLabelDisplay="auto"
          onChange={handleChange}
        />
      </div>
      <div
        className={css`
          display: grid;
          place-items: center;
          min-height: 100vh;
          width: 100%;
        `}
      >
        <div ref={graphDomRef} />
      </div>
    </>
  );
};

const container = document.getElementById('root');

const root = createRoot(container);

root.render(<App />);
