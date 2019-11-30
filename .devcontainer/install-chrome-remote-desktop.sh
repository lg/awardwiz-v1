# as per: https://cloud.google.com/solutions/chrome-desktop-remote-on-compute-engine

# install chrome remote desktop
wget https://dl.google.com/linux/direct/chrome-remote-desktop_current_amd64.deb
sudo apt update
sudo dpkg --install chrome-remote-desktop_current_amd64.deb
sudo apt install --assume-yes --fix-broken

# install the X server and a proper screensaver that's compatible with chrome remote desktop
sudo DEBIAN_FRONTEND=noninteractive apt install --assume-yes xfce4 desktop-base
sudo apt install --assume-yes xscreensaver

sudo systemctl disable lightdm.service

rm chrome-remote-desktop_current_amd64.deb