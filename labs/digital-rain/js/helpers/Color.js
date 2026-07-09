//

export const hsl2rgb = (h, s, l) => {
  if (s == 0)
    return [255*l, 255*l, 255*l]
  let r, g, b
  const hue2rgb = (p, q, t) => {
    if(t < 0) t += 1
    if(t > 1) t -= 1
    if(t < 1/6) return p + 6*t*(q - p)
    if(t < 1/2) return q
    if(t < 2/3) return p + 6*(2/3 - t)*(q - p)
    return p
  }
  let q = l < 0.5 ? l*(1 + s) : l + s - l*s
  let p = 2*l - q
  r = hue2rgb(p, q, h + 1/3);
  g = hue2rgb(p, q, h);
  b = hue2rgb(p, q, h - 1/3);
  return [255*r, 255*g, 255*b]
}

export const rgb2hsl = (r, g, b) => {
  r /= 255, g /= 255, b /= 255
  let max = Math.max(r, g, b)
  let min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2

  if (max == min) {
      h = s = 0
  } else {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch(max){
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
  }
  return [h, s, l]
}

export const rgbRandom = () => {
  return [
    parseInt(255*Math.random()),
    parseInt(255*Math.random()),
    parseInt(255*Math.random()), ]
}

export const rgbBrightness = (r, g, b) => {
  return parseInt((r + g + b)/3)
}
