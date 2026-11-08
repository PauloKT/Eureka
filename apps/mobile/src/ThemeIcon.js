import React, { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { Image } from 'expo-image';
const icons={
  space:[require('../assets/themes/space.webp'),require('../assets/themes/space.png')],
  health:[require('../assets/themes/health.webp'),require('../assets/themes/health.png')],
  brain:[require('../assets/themes/brain.webp'),require('../assets/themes/brain.png')],
  technology:[require('../assets/themes/technology.webp'),require('../assets/themes/technology.png')],
  nature:[require('../assets/themes/nature.webp'),require('../assets/themes/nature.png')],
  physics:[require('../assets/themes/physics.webp'),require('../assets/themes/physics.png')],
};
export default function ThemeIcon({ theme, selected }) {
  const [reduceMotion,setReduceMotion]=useState(true);
  useEffect(()=>{let live=true;AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(live)setReduceMotion(value);}).catch(()=>{});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);return()=>{live=false;sub.remove();};},[]);
  const animate=selected&&!reduceMotion;
  return <Image source={icons[theme][animate?0:1]} contentFit="contain" autoplay={animate} accessible={false} style={{width:80,height:80}}/>;
}
