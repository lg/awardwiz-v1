# add the display environment variable for making debugging easier
echo 'DISPLAY=:20.0' >> ~/workspace/.env

# install chrome remote desktop as per: https://cloud.google.com/solutions/chrome-desktop-remote-on-compute-engine
wget https://dl.google.com/linux/direct/chrome-remote-desktop_current_amd64.deb
sudo apt update
sudo dpkg --install chrome-remote-desktop_current_amd64.deb
sudo apt install --assume-yes --fix-broken
rm chrome-remote-desktop_current_amd64.deb

# install the X server and disable screensaver
sudo DEBIAN_FRONTEND=noninteractive apt install --assume-yes xfce4
sudo bash -c 'echo "exec /etc/X11/Xsession /usr/bin/xfce4-session" > /etc/chrome-remote-desktop-session'
sudo systemctl disable lightdm.service

echo "\nNow go to https://remotedesktop.google.com/headless to register this Chrome Remote Desktop instance."