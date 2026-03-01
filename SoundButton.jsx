import React from 'react';
import useSound from 'use-sound';

// Assuming you have a sound file at this path
import boopSfx from '../sounds/boop.mp3';

const SoundButton = () => {
  const [play] = useSound(boopSfx);

  return (
    <button onClick={play}>Boop!</button>
  );
};

export default SoundButton;