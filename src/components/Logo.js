import React from 'react';
import { Image, View } from 'react-native';

const Logo = ({ size = 100 }) => {
  return (
    <View style={{ width: size, height: size }}>
      <Image 
        source={require('../../assets/icon.png')} 
        style={{ width: '100%', height: '100%', resizeMode: 'contain' }} 
      />
    </View>
  );
};

export default Logo;
