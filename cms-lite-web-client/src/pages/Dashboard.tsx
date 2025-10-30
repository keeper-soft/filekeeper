import {AppLayout} from '../layout';
import {SmartDashboard} from './SmartDashboard';
import {useDispatch, useSelector} from 'react-redux';
import {useEffect} from "react";
import {selectCurrentView} from "../store/slices/navigation.ts";

export const Dashboard = () => {
    const dispatch = useDispatch();
    const pageViewNavigation = useSelector(selectCurrentView);
    useEffect(() => {
        dispatch({type: 'navigation/setCurrentView', payload: 'dashboard'})
    }, [pageViewNavigation, dispatch]);
    return (
        <AppLayout>
            <SmartDashboard/>
        </AppLayout>
    );
}