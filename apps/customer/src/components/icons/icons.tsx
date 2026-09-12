import React from "react";
import { SvgProps } from "react-native-svg";
import * as Icons from "assets/icons";

type IconName = keyof typeof Icons;

interface IconProps extends SvgProps {
    name: IconName;
    size?: number;
    color?: string;
}

export const IconsComponent: React.FC<IconProps> = ({
    name,
    size = 24,
    color = "currentColor",
    ...rest
}) => {
    const SelectedIcon = Icons[name];

    if (!SelectedIcon) {
        console.warn(`Icon "${name}" not found in /assets/icons`);
        return null;
    }

    return <SelectedIcon width={size} height={size} fill={color} {...rest} />;
};
