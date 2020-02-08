# WebGL Water Demo

http://madebyevan.com/webgl-water/


# Modified by Mohammed Abdullhak:

- All modifications can be found under comments starting with "Modified for:"
- All modifications can be seen @ https://github.com/m-abdulhak/WebGLWater where detailed changes to the code can be seen from git commits

# List of Modifications:
- Add new physics logic to simulate ball bouncing off walls and ceiling and not leaving pool.
- Change application variables such as camera angles, field of view, ball size, position, and velocity, and gravity.
- Create new application and shader variables to hold new options such as ball size, ball color, water color, camera position...
- Change variables passed to shaders, for instance: to change light source according to current camera position.
- Change data passed to vertex shader to show / hide ceiling
- Change fragment shader logic for calculating walls’ color to change wall heights
- Change pool walls texture files
- Change user interaction logic to handle new option keys events such as pressing R key resets sphere position and velocity
- Change HTML UI to show new options to allow users to dynamically change some options such as: ball size, ball speed, ball color, water color (New options shown in green)

# COMP-6909 Fundamentals of Computer Graphics - Memorial Univeristy (Winter 2020)
